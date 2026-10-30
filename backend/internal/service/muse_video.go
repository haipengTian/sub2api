package service

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

const (
	MuseVideoEndpointCreate           GrokMediaEndpoint        = "muse_video_create"
	MuseVideoEndpointStatus           GrokMediaEndpoint        = "muse_video_status"
	MuseVideoEndpointContent          GrokMediaEndpoint        = "muse_video_content"
	OpenAIEndpointCapabilityMuseVideo OpenAIEndpointCapability = "muse_video"
)

func (e GrokMediaEndpoint) IsMuseVideo() bool {
	return e == MuseVideoEndpointCreate || e == MuseVideoEndpointStatus || e == MuseVideoEndpointContent
}

func IsMuseVideoTask(id string) bool { return strings.HasPrefix(id, "muse:") }
func IsMuseVideoModel(model string) bool {
	return strings.EqualFold(strings.TrimSpace(model), "muse-video")
}

// Muse interprets duration as a prompt hint, defaulting to six seconds. Keep
// positive requested durations intact instead of applying xAI's 15-second cap.
func NormalizeVideoDurationForModel(model string, seconds int) int {
	if IsMuseVideoModel(model) {
		if seconds <= 0 {
			return 6
		}
		return seconds
	}
	return NormalizeVideoBillingDurationSecondsOrDefault(seconds)
}

func ParseMuseVideoRequest(body []byte) (GrokMediaRequestInfo, error) {
	var info GrokMediaRequestInfo
	if !gjson.ValidBytes(body) || !gjson.ParseBytes(body).IsObject() {
		return info, fmt.Errorf("request body must be a JSON object")
	}
	model := gjson.GetBytes(body, "model")
	if model.Type != gjson.String || !IsMuseVideoModel(model.String()) {
		return info, fmt.Errorf("Muse video requires model muse-video")
	}
	prompt := gjson.GetBytes(body, "prompt")
	if prompt.Type != gjson.String || strings.TrimSpace(prompt.String()) == "" {
		return info, fmt.Errorf("prompt is required")
	}
	parseGrokMediaJSONRequest(body, &info)
	info.Model = "muse-video"
	// Muse appends extra to the generation prompt. Include it in moderation,
	// while forwarding the original JSON unchanged.
	if extra := strings.TrimSpace(gjson.GetBytes(body, "extra").String()); extra != "" {
		info.Prompt += "\n" + extra
	}
	for _, field := range []string{"image_url", "reference_image"} {
		if ref := extractGrokMediaImageURL(gjson.GetBytes(body, field)); ref != "" {
			info.InputImageURLs = append(info.InputImageURLs, ref)
		}
	}
	duration := gjson.GetBytes(body, "duration")
	if duration.Exists() && duration.Type != gjson.Null && (duration.Type != gjson.Number || duration.Float() <= 0 || duration.Float() != float64(duration.Int())) {
		return info, fmt.Errorf("duration must be a positive integer")
	}
	info.DurationSeconds = NormalizeVideoDurationForModel(info.Model, info.DurationSeconds)
	info.Resolution = NormalizeVideoBillingResolutionOrDefault(info.Resolution)
	if resolution := gjson.GetBytes(body, "resolution"); resolution.Exists() && resolution.Type != gjson.Null && resolution.String() != "" {
		if _, ok := LookupVideoBillingResolution(resolution.String()); !ok {
			return info, fmt.Errorf("resolution must be 480p, 720p or 1080p")
		}
	}
	info.N = 1
	return info, nil
}

func museVideoTaskID(task string) (string, error) {
	if !IsMuseVideoTask(task) {
		return "", fmt.Errorf("invalid Muse video task ID")
	}
	id := strings.TrimPrefix(task, "muse:")
	if id == "" {
		return "", fmt.Errorf("invalid Muse video task ID")
	}
	if err := validateUpstreamPathSegment("Muse video task ID", id); err != nil {
		return "", err
	}
	return id, nil
}

// Only take a safe media filename, never an arbitrary upstream-provided origin.
func museVideoFilename(body []byte) (string, error) {
	filename := gjson.GetBytes(body, "result.filename").String()
	if filename == "" {
		for _, field := range []string{"video.url", "result.url", "url"} {
			raw := gjson.GetBytes(body, field).String()
			if raw == "" {
				continue
			}
			parsed, err := url.Parse(raw)
			if err != nil {
				return "", fmt.Errorf("invalid Muse media URL")
			}
			marker := "/v1/media/"
			at := strings.LastIndex(parsed.Path, marker)
			if at < 0 {
				return "", fmt.Errorf("unsupported Muse media path")
			}
			filename = parsed.Path[at+len(marker):]
			break
		}
	}
	if filename == "" || strings.Contains(filename, "..") {
		return "", fmt.Errorf("Muse video has no valid media filename")
	}
	if err := validateUpstreamPathSegment("Muse media filename", filename); err != nil {
		return "", err
	}
	return filename, nil
}

// ForwardMuseVideo shares the gateway's task ownership, admission and one-shot
// billing machinery. Async creates are never retried after an ambiguous result.
func (s *OpenAIGatewayService) ForwardMuseVideo(ctx context.Context, c *gin.Context, account *Account, endpoint GrokMediaEndpoint, task string, body []byte) (*OpenAIForwardResult, error) {
	if !endpoint.IsMuseVideo() || !account.SupportsOpenAIEndpointCapability(OpenAIEndpointCapabilityMuseVideo) {
		return nil, fmt.Errorf("Muse video requires an OpenAI API key account with a custom base URL")
	}
	base, err := s.validateUpstreamBaseURL(account.GetCredential("base_url"))
	if err != nil {
		return nil, err
	}
	token := strings.TrimSpace(account.GetCredential("api_key"))
	if token == "" {
		return nil, fmt.Errorf("Muse video account missing api_key")
	}
	started := time.Now()
	target := buildOpenAIImagesURL(base, "/v1/videos")
	method := http.MethodGet
	result := &OpenAIForwardResult{}
	if endpoint == MuseVideoEndpointCreate {
		info, err := ParseMuseVideoRequest(body)
		if err != nil {
			return nil, err
		}
		mapped := account.GetMappedModel(info.Model)
		if !IsMuseVideoModel(mapped) {
			return nil, fmt.Errorf("Muse video account must map muse-video to muse-video")
		}
		body, err = sjson.SetBytes(body, "model", "muse-video")
		if err != nil {
			return nil, err
		}
		method = http.MethodPost
		result.Model, result.BillingModel, result.UpstreamModel = info.Model, info.Model, "muse-video"
		result.VideoResolution, result.VideoDurationSeconds = info.Resolution, info.DurationSeconds
	} else {
		id, err := museVideoTaskID(task)
		if err != nil {
			return nil, err
		}
		target += "/" + id
		result.ResponseID = task
	}
	proxy := ""
	if account.ProxyID != nil && account.Proxy != nil {
		proxy = account.Proxy.URL()
	}
	req, err := http.NewRequestWithContext(WithHTTPUpstreamRedirectsDisabled(ctx), method, target, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	account.ApplyHeaderOverrides(req.Header)
	resp, err := s.httpUpstream.Do(req, proxy, account.ID, account.Concurrency)
	SetOpsLatencyMs(c, OpsUpstreamLatencyMsKey, time.Since(started).Milliseconds())
	if err != nil {
		return nil, err
	}
	defer func() { _ = resp.Body.Close() }()
	responseBody, err := ReadUpstreamResponseBody(resp.Body, s.cfg, c, openAITooLargeError)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 300 {
		// Never return a Location header or follow redirects carrying credentials.
		if resp.StatusCode < 400 {
			return nil, fmt.Errorf("Muse video upstream redirect is not allowed")
		}
		writeGrokMediaResponse(c, resp, responseBody, s.responseHeaderFilter)
		return nil, fmt.Errorf("Muse video upstream status %d", resp.StatusCode)
	}
	if !gjson.ValidBytes(responseBody) || !gjson.ParseBytes(responseBody).IsObject() {
		return nil, fmt.Errorf("invalid Muse video response")
	}
	if endpoint == MuseVideoEndpointCreate {
		id := extractGrokMediaVideoRequestID(responseBody)
		if id == "" {
			return nil, fmt.Errorf("Muse video create response missing task ID")
		}
		task = "muse:" + id
		if _, err := museVideoTaskID(task); err != nil {
			return nil, err
		}
		result.ResponseID = task
	}
	// Namespaced IDs make model-less composite lookups unambiguous.
	responseBody, err = sjson.SetBytes(responseBody, "id", task)
	if err != nil {
		return nil, err
	}
	responseBody, err = sjson.SetBytes(responseBody, "task_id", task)
	if err != nil {
		return nil, err
	}
	status := gjson.GetBytes(responseBody, "status").String()
	filename := ""
	if status == "completed" {
		filename, err = museVideoFilename(responseBody)
		if err != nil {
			return nil, err
		}
		// Completion is billed on observation, not on submission.
		if endpoint != MuseVideoEndpointCreate {
			result.VideoCount = 1
		}
		for _, field := range []string{"url", "video.url", "result.url"} {
			responseBody, err = sjson.SetBytes(responseBody, field, grokMediaContentProxyURL(c, task))
			if err != nil {
				return nil, err
			}
		}
	}
	result.Duration, result.ResponseHeaders = time.Since(started), resp.Header.Clone()
	if endpoint != MuseVideoEndpointContent {
		writeGrokMediaResponse(c, resp, responseBody, s.responseHeaderFilter)
		return result, nil
	}
	if filename == "" {
		c.JSON(http.StatusConflict, gin.H{"error": gin.H{"type": "video_not_ready", "message": "Video is not completed", "status": status}})
		return result, nil
	}
	contentURL := buildOpenAIImagesURL(base, "/v1/media/"+filename)
	mediaReq, err := http.NewRequestWithContext(WithHTTPUpstreamRedirectsDisabled(ctx), http.MethodGet, contentURL, nil)
	if err != nil {
		return nil, err
	}
	mediaReq.Header.Set("Accept", "*/*")
	if value := c.GetHeader("Range"); value != "" {
		mediaReq.Header.Set("Range", value)
	}
	// Muse media is public. Do not forward API keys or account header overrides.
	mediaResp, err := s.httpUpstream.Do(mediaReq, proxy, account.ID, account.Concurrency)
	SetOpsLatencyMs(c, OpsUpstreamLatencyMsKey, time.Since(started).Milliseconds())
	if err != nil {
		return nil, err
	}
	defer func() { _ = mediaResp.Body.Close() }()
	if mediaResp.StatusCode != http.StatusOK && mediaResp.StatusCode != http.StatusPartialContent && mediaResp.StatusCode != http.StatusRequestedRangeNotSatisfiable {
		return nil, fmt.Errorf("Muse media download status %d", mediaResp.StatusCode)
	}
	result.Duration = time.Since(started)
	if err := writeGrokMediaContentResponse(c, mediaResp); err != nil {
		return nil, err
	}
	return result, nil
}
