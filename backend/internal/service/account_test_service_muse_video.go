package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// Admin account tests use the selected account directly, just like image tests.
// They consume upstream generation quota, not a user's gateway balance.
func (s *AccountTestService) testMuseVideoGeneration(c *gin.Context, account *Account, opts AccountTestOptions, prompt string) error {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 6*time.Minute)
	defer cancel()
	base, err := s.validateUpstreamBaseURL(account.GetOpenAIBaseURL())
	if err != nil {
		return s.sendErrorAndEnd(c, "Invalid Muse base URL: "+err.Error())
	}
	token := strings.TrimSpace(account.GetOpenAIProtocolAPIKey())
	if token == "" {
		return s.sendErrorAndEnd(c, "No API key available")
	}
	payload := map[string]any{
		"model": "muse-video", "prompt": resolveGrokVideoPrompt(prompt),
		"duration": 6, "aspect_ratio": "16:9", "resolution": "480p",
	}
	if opts.ImageDataURL != "" {
		image, err := normalizeAccountTestImageDataURL(opts.ImageDataURL)
		if err != nil {
			return s.sendErrorAndEnd(c, err.Error())
		}
		payload["image"] = image
	}
	encoded, _ := json.Marshal(payload)
	apiURL := buildOpenAIImagesURL(base, "/v1/videos")
	s.prepareGrokTestSSE(c)
	s.sendEvent(c, TestEvent{Type: "test_start", Model: "muse-video"})
	s.sendEvent(c, TestEvent{Type: "status", Text: "Calling Muse /v1/videos..."})
	// Never retry an asynchronous create: a transport failure may hide an
	// accepted task, and retrying would consume the upstream quota again.
	body, _, err := s.museAccountTestRequest(ctx, account, token, http.MethodPost, apiURL, encoded, 1<<20)
	if err != nil {
		return s.sendErrorAndEnd(c, err.Error())
	}
	if !gjson.ValidBytes(body) || !gjson.ParseBytes(body).IsObject() {
		return s.sendErrorAndEnd(c, "Invalid Muse video create JSON")
	}
	taskID := strings.TrimSpace(firstNonEmpty(gjson.GetBytes(body, "id").String(), gjson.GetBytes(body, "task_id").String()))
	if err := validateUpstreamPathSegment("Muse video task ID", taskID); err != nil {
		return s.sendErrorAndEnd(c, err.Error())
	}
	statusURL := apiURL + "/" + taskID
	polled := false
	for {
		if !gjson.ValidBytes(body) || !gjson.ParseBytes(body).IsObject() {
			return s.sendErrorAndEnd(c, "Invalid Muse video status JSON (task ID="+taskID+")")
		}
		if id := firstNonEmpty(gjson.GetBytes(body, "id").String(), gjson.GetBytes(body, "task_id").String()); id != "" && id != taskID {
			return s.sendErrorAndEnd(c, "Muse video status task ID mismatch")
		}
		state := strings.ToLower(strings.TrimSpace(gjson.GetBytes(body, "status").String()))
		progress := gjson.GetBytes(body, "progress")
		data := map[string]any{"task_id": taskID}
		text := "status=" + state
		if progress.Type == gjson.Number && progress.Float() >= 0 && progress.Float() <= 100 {
			data["progress"] = progress.Float()
			text += fmt.Sprintf(" progress=%v", progress.Float())
		}
		s.sendEvent(c, TestEvent{Type: "status", Status: state, Data: data, Text: text})
		switch state {
		case "completed":
			return s.emitMuseAccountTestVideo(c, ctx, account, token, base, body)
		case "failed", "error", "canceled", "cancelled":
			message := gjson.GetBytes(body, "error").String()
			return s.sendErrorAndEnd(c, "Muse video failed (task ID="+taskID+"): "+sanitizeUpstreamErrorMessage(message))
		}
		// Poll immediately after create, then every three seconds. Closing the
		// dialog cancels this wait, not the task already submitted to Muse.
		if polled {
			select {
			case <-ctx.Done():
				return s.sendErrorAndEnd(c, "Muse video wait ended (task ID="+taskID+"; upstream task may still be running)")
			case <-time.After(3 * time.Second):
			}
		}
		if body, _, err = s.museAccountTestRequest(ctx, account, token, http.MethodGet, statusURL, nil, 1<<20); err != nil {
			return s.sendErrorAndEnd(c, fmt.Sprintf("%s (task ID=%s; do not submit again)", err, taskID))
		}
		polled = true
	}
}

func (s *AccountTestService) museAccountTestRequest(ctx context.Context, account *Account, token, method, target string, payload []byte, limit int64) ([]byte, string, error) {
	if err := ctx.Err(); err != nil {
		return nil, "", err
	}
	req, err := http.NewRequestWithContext(WithHTTPUpstreamRedirectsDisabled(ctx), method, target, bytes.NewReader(payload))
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	account.ApplyHeaderOverrides(req.Header)
	resp, err := s.httpUpstream.Do(req, s.grokTestProxyURL(account), account.ID, account.Concurrency)
	if err != nil {
		return nil, "", fmt.Errorf("muse request failed: %s", sanitizeUpstreamErrorMessage(err.Error()))
	}
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, "", fmt.Errorf("failed to read Muse response: %w", err)
	}
	if int64(len(body)) > limit {
		return nil, "", fmt.Errorf("muse response exceeds preview size limit")
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("muse API returned %d: %s", resp.StatusCode, sanitizeUpstreamErrorMessage(truncateString(string(body), 500)))
	}
	return body, resp.Header.Get("Content-Type"), nil
}

func (s *AccountTestService) emitMuseAccountTestVideo(c *gin.Context, ctx context.Context, account *Account, token, base string, body []byte) error {
	media := firstNonEmpty(gjson.GetBytes(body, "url").String(), gjson.GetBytes(body, "video.url").String(), gjson.GetBytes(body, "result.url").String())
	parsed, err := url.Parse(media)
	if err != nil || media == "" || (parsed.Scheme != "" && parsed.Scheme != "http" && parsed.Scheme != "https") {
		return s.sendErrorAndEnd(c, "Muse completed without a valid media URL")
	}
	// Download only the known Muse media path at the configured origin. Never
	// send the upstream key to a host supplied in a task response (SSRF/leak).
	filename := strings.TrimPrefix(parsed.Path, "/v1/media/")
	if !strings.HasPrefix(parsed.Path, "/v1/media/") || validateUpstreamPathSegment("Muse media filename", filename) != nil {
		return s.sendErrorAndEnd(c, "Invalid Muse media path")
	}
	s.sendEvent(c, TestEvent{Type: "status", Text: "Downloading Muse video for preview..."})
	video, contentType, err := s.museAccountTestRequest(ctx, account, token, http.MethodGet, buildOpenAIImagesURL(base, "/v1/media/"+filename), nil, 32<<20)
	if err != nil {
		return s.sendErrorAndEnd(c, err.Error())
	}
	mediaType, _, err := mime.ParseMediaType(contentType)
	if err != nil || !strings.HasPrefix(mediaType, "video/") || len(video) == 0 {
		return s.sendErrorAndEnd(c, "Muse media response is not a video")
	}
	s.sendEvent(c, TestEvent{Type: "video", VideoURL: "data:" + mediaType + ";base64," + base64.StdEncoding.EncodeToString(video), MimeType: mediaType})
	s.sendEvent(c, TestEvent{Type: "test_complete", Success: true})
	return nil
}
