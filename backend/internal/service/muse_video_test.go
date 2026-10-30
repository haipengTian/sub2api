//go:build unit

package service

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func museVideoAccount() *Account {
	return &Account{ID: 9, Platform: PlatformOpenAI, Type: AccountTypeAPIKey, Credentials: map[string]any{"api_key": "test-muse-key", "base_url": "https://muse.example", "model_mapping": map[string]any{"muse-video": "muse-video"}}}
}

func TestMuseVideoCreatePreservesReferenceAndFields(t *testing.T) {
	body := []byte(`{"model":"muse-video","prompt":"waves","duration":20,"resolution":"720p","images":["data:image/png;base64,aGVsbG8="],"image_url":{"url":"https://example.com/a.png"},"extra":"no music","timeout":900}`)
	upstream := &grokMediaContentUpstreamStub{response: grokMediaContentStatusResponse(`{"id":"task-1","task_id":"task-1","status":"queued","progress":10}`)}
	svc := &OpenAIGatewayService{httpUpstream: upstream, cfg: &config.Config{}}
	c, w := grokMediaContentTestContext(http.MethodPost, "/v1/videos", nil)
	result, err := svc.ForwardMuseVideo(context.Background(), c, museVideoAccount(), MuseVideoEndpointCreate, "", body)
	require.NoError(t, err)
	require.Equal(t, "https://muse.example/v1/videos", upstream.request.URL.String())
	require.Equal(t, "Bearer test-muse-key", upstream.request.Header.Get("Authorization"))
	forwarded, err := io.ReadAll(upstream.request.Body)
	require.NoError(t, err)
	require.JSONEq(t, string(body), string(forwarded))
	require.Equal(t, "muse:task-1", result.ResponseID)
	require.Equal(t, "muse:task-1", gjson.Get(w.Body.String(), "id").String())
	require.Equal(t, "muse:task-1", gjson.Get(w.Body.String(), "task_id").String())
	require.Equal(t, 20, result.VideoDurationSeconds)
	require.Equal(t, "720p", result.VideoResolution)
	require.Zero(t, result.VideoCount)
	info, err := ParseMuseVideoRequest(body)
	require.NoError(t, err)
	require.Len(t, info.InputImageURLs, 2)
	require.Contains(t, string(info.ModerationBody()), "no music")
}

func TestMuseVideoValidationAndDefaults(t *testing.T) {
	info, err := ParseMuseVideoRequest([]byte(`{"model":"muse-video","prompt":"waves"}`))
	require.NoError(t, err)
	require.Equal(t, 6, info.DurationSeconds)
	for _, body := range []string{`{`, `[]`, `{}`, `{"model":"gpt-5","prompt":"x"}`, `{"model":"muse-video","prompt":""}`, `{"model":"muse-video","prompt":"x","duration":0}`, `{"model":"muse-video","prompt":"x","duration":1.5}`, `{"model":"muse-video","prompt":"x","resolution":"4k"}`} {
		_, err := ParseMuseVideoRequest([]byte(body))
		require.Error(t, err, body)
	}
	account := museVideoAccount()
	require.True(t, account.SupportsOpenAIEndpointCapability(OpenAIEndpointCapabilityMuseVideo))
	account.Type = AccountTypeOAuth
	require.False(t, account.SupportsOpenAIEndpointCapability(OpenAIEndpointCapabilityMuseVideo))
	account.Type = AccountTypeAPIKey
	account.Platform = PlatformGrok
	require.False(t, account.SupportsOpenAIEndpointCapability(OpenAIEndpointCapabilityMuseVideo))
	account.Platform = PlatformOpenAI
	delete(account.Credentials, "model_mapping")
	require.False(t, account.SupportsOpenAIEndpointCapability(OpenAIEndpointCapabilityMuseVideo), "ordinary unrestricted OpenAI relays must not become Muse providers")
	for _, id := range []string{"task-1", "muse:", "muse:..", "muse:a/b", "muse:%2e%2e", "muse:a?b"} {
		_, err := museVideoTaskID(id)
		require.Error(t, err, id)
	}
	require.Equal(t, 20, NormalizeVideoDurationForModel("muse-video", 20))
	require.Equal(t, 15, NormalizeVideoDurationForModel("grok-imagine-video", 20))
	price := 0.1
	cost := (&BillingService{}).CalculateVideoCost("muse-video", "720p", 1, 20, &VideoPriceConfig{Price720P: &price}, 1)
	require.InDelta(t, 2, cost.TotalCost, 0.00001)
}

func TestMuseVideoStatusPreservesProgressAndProxiesMedia(t *testing.T) {
	for _, status := range []string{"queued", "processing", "failed", "completed"} {
		t.Run(status, func(t *testing.T) {
			upstream := &grokMediaContentUpstreamStub{response: grokMediaContentStatusResponse(`{"id":"task-1","status":"` + status + `","progress":27,"url":"https://external.example/v1/media/video.mp4","video":{"url":"https://external.example/v1/media/video.mp4"},"result":{"url":"https://external.example/v1/media/video.mp4","filename":"video.mp4"}}`)}
			svc := &OpenAIGatewayService{httpUpstream: upstream}
			c, w := grokMediaContentTestContext(http.MethodGet, "/v1/videos/muse:task-1", nil)
			result, err := svc.ForwardMuseVideo(context.Background(), c, museVideoAccount(), MuseVideoEndpointStatus, "muse:task-1", nil)
			require.NoError(t, err)
			require.Equal(t, "/v1/videos/task-1", upstream.request.URL.Path)
			require.Equal(t, status, gjson.Get(w.Body.String(), "status").String())
			require.Equal(t, int64(27), gjson.Get(w.Body.String(), "progress").Int())
			if status == "completed" {
				require.Equal(t, 1, result.VideoCount)
				for _, field := range []string{"url", "video.url", "result.url"} {
					require.Equal(t, "/v1/videos/muse:task-1/content", gjson.Get(w.Body.String(), field).String())
				}
			} else {
				require.Zero(t, result.VideoCount)
			}
		})
	}
}

func TestMuseVideoContentIsOriginBoundAndStreamsRange(t *testing.T) {
	for _, code := range []int{200, 206, 416} {
		upstream := &grokMediaContentUpstreamStub{responses: []*http.Response{
			grokMediaContentStatusResponse(`{"id":"task-1","status":"completed","video":{"url":"http://169.254.169.254/v1/media/video.mp4"}}`),
			{StatusCode: code, Header: http.Header{"Content-Type": []string{"video/mp4"}, "Content-Range": []string{"bytes 0-4/10"}}, Body: io.NopCloser(strings.NewReader("video"))},
		}}
		svc := &OpenAIGatewayService{httpUpstream: upstream}
		account := museVideoAccount()
		account.Credentials["base_url"] = "https://muse.example/proxy/v1"
		c, w := grokMediaContentTestContext(http.MethodGet, "/v1/videos/muse:task-1/content", map[string]string{"Range": "bytes=0-4"})
		result, err := svc.ForwardMuseVideo(context.Background(), c, account, MuseVideoEndpointContent, "muse:task-1", nil)
		require.NoError(t, err)
		require.Equal(t, code, w.Code)
		require.Equal(t, "video", w.Body.String())
		require.Len(t, upstream.requests, 2)
		require.Equal(t, "https://muse.example/proxy/v1/media/video.mp4", upstream.requests[1].URL.String())
		require.Empty(t, upstream.requests[1].Header.Get("Authorization"))
		require.Equal(t, "bytes=0-4", upstream.requests[1].Header.Get("Range"))
		require.Equal(t, 1, result.VideoCount)
	}
}

func TestMuseVideoUnsafeMediaAndPendingDownload(t *testing.T) {
	for _, body := range []string{`{"result":{"filename":"../secret"}}`, `{"result":{"filename":"a/b"}}`, `{"url":"http://localhost/admin"}`, `{"url":"https://muse.example/v1/media/%252e%252e"}`} {
		_, err := museVideoFilename([]byte(body))
		require.Error(t, err, body)
	}
	upstream := &grokMediaContentUpstreamStub{response: grokMediaContentStatusResponse(`{"status":"processing","progress":15}`)}
	svc := &OpenAIGatewayService{httpUpstream: upstream}
	c, w := grokMediaContentTestContext(http.MethodGet, "/v1/videos/muse:task-1/content", nil)
	result, err := svc.ForwardMuseVideo(context.Background(), c, museVideoAccount(), MuseVideoEndpointContent, "muse:task-1", nil)
	require.NoError(t, err)
	require.Equal(t, 409, w.Code)
	require.Zero(t, result.VideoCount)
	require.Len(t, upstream.requests, 1)
}

func TestMuseVideoErrorDoesNotRetry(t *testing.T) {
	for _, code := range []int{302, 429, 500} {
		upstream := &grokMediaContentUpstreamStub{response: grokMediaContentStatusResponse(`{"error":"upstream failure"}`)}
		upstream.response.StatusCode = code
		svc := &OpenAIGatewayService{httpUpstream: upstream}
		c, w := grokMediaContentTestContext(http.MethodPost, "/v1/videos", nil)
		_, err := svc.ForwardMuseVideo(context.Background(), c, museVideoAccount(), MuseVideoEndpointCreate, "", []byte(`{"model":"muse-video","prompt":"waves"}`))
		require.Error(t, err)
		require.Len(t, upstream.requests, 1)
		if code >= 400 {
			require.Equal(t, code, w.Code)
		}
	}
}
