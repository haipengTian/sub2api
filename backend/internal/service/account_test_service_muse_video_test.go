//go:build unit

package service

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/Wei-Shaw/sub2api/internal/config"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func museAccountForUITest() *Account {
	return &Account{ID: 42, Platform: PlatformOpenAI, Type: AccountTypeAPIKey, Credentials: map[string]any{
		"base_url": "https://muse.example/v1", "api_key": "test-key",
		"model_mapping": map[string]any{"movie": "muse-video", "muse-video": "muse-video"},
	}}
}

func TestAccountTestMuseVideoCreatesPollsAndPreviews(t *testing.T) {
	account := museAccountForUITest()
	upstream := &grokMediaContentUpstreamStub{responses: []*http.Response{
		newJSONResponse(202, `{"task_id":"task_1","status":"queued","progress":10}`),
		newJSONResponse(200, `{"id":"task_1","status":"processing","progress":42}`),
		newJSONResponse(200, `{"id":"task_1","status":"completed","progress":100,"result":{"url":"https://cdn.example/v1/media/clip.mp4"}}`),
		{StatusCode: 200, Header: http.Header{"Content-Type": {"video/mp4"}}, Body: io.NopCloser(strings.NewReader("ABC"))},
	}}
	svc := &AccountTestService{cfg: &config.Config{}, httpUpstream: upstream,
		accountRepo: &mockAccountRepoForGemini{accountsByID: map[int64]*Account{42: account}}}
	c, rec := newTestContext()
	err := svc.TestAccountConnection(c, 42, "movie", "waves", "default", AccountTestOptions{ImageDataURL: "data:image/png;base64,iVBORw0KGgo="})
	require.NoError(t, err)
	require.Len(t, upstream.requests, 4)
	require.Equal(t, "https://muse.example/v1/videos", upstream.requests[0].URL.String())
	body, err := io.ReadAll(upstream.requests[0].Body)
	require.NoError(t, err)
	require.Equal(t, "muse-video", gjson.GetBytes(body, "model").String())
	require.Equal(t, "waves", gjson.GetBytes(body, "prompt").String())
	require.Equal(t, int64(6), gjson.GetBytes(body, "duration").Int())
	require.NotEmpty(t, gjson.GetBytes(body, "image").String())
	require.Equal(t, "https://muse.example/v1/videos/task_1", upstream.requests[1].URL.String())
	require.Equal(t, "https://muse.example/v1/media/clip.mp4", upstream.requests[3].URL.String(), "download uses configured origin, not upstream-supplied host")
	for _, req := range upstream.requests {
		require.Equal(t, "Bearer test-key", req.Header.Get("Authorization"))
		require.True(t, HTTPUpstreamRedirectsDisabled(req.Context()), "never redirect credential-bearing create/status/download")
	}
	require.Contains(t, rec.Body.String(), `"progress":42`)
	require.Contains(t, rec.Body.String(), `data:video/mp4;base64,QUJD`)
	require.Contains(t, rec.Body.String(), `"success":true`)
}

func TestAccountTestMuseVideoErrorsDoNotUseChatOrRetryCreate(t *testing.T) {
	for _, tc := range []struct {
		name      string
		responses []*http.Response
		want      string
	}{
		{"create rejected", []*http.Response{newJSONResponse(502, `{"error":"session unavailable"}`)}, "502"},
		{"redirect rejected", []*http.Response{newJSONResponse(307, `redirect`)}, "307"},
		{"bad create JSON", []*http.Response{newJSONResponse(200, `<html>login</html>`)}, "JSON"},
		{"missing task", []*http.Response{newJSONResponse(200, `{"status":"queued"}`)}, "task ID"},
		{"bad task", []*http.Response{newJSONResponse(200, `{"id":"../other","status":"queued"}`)}, "task ID"},
		{"failed", []*http.Response{newJSONResponse(200, `{"id":"task_1","status":"queued"}`), newJSONResponse(200, `{"id":"task_1","status":"failed","error":"session unavailable"}`)}, "session unavailable"},
		{"invalid JSON", []*http.Response{newJSONResponse(200, `{"id":"task_1"}`), newJSONResponse(200, `<html>login</html>`)}, "JSON"},
		{"missing video", []*http.Response{newJSONResponse(200, `{"id":"task_1"}`), newJSONResponse(200, `{"status":"completed"}`)}, "media"},
		{"unsafe media", []*http.Response{newJSONResponse(200, `{"id":"task_1"}`), newJSONResponse(200, `{"status":"completed","url":"https://evil.example/private/secrets"}`)}, "media"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			upstream := &grokMediaContentUpstreamStub{responses: tc.responses}
			svc := &AccountTestService{cfg: &config.Config{}, httpUpstream: upstream}
			c, rec := newTestContext()
			err := svc.testOpenAIAccountConnection(c, museAccountForUITest(), "movie", "waves", "default")
			require.ErrorContains(t, err, tc.want)
			require.NotContains(t, rec.Body.String(), `"success":true`)
			posts := 0
			for _, req := range upstream.requests {
				if req.Method == http.MethodPost {
					posts++
				}
				require.NotContains(t, req.URL.Path, "chat")
			}
			require.Equal(t, 1, posts)
		})
	}
}

func TestAccountTestMuseVideoRejectsOAuthAndCompact(t *testing.T) {
	for _, tc := range []struct{ accountType, mode string }{{AccountTypeOAuth, "default"}, {AccountTypeAPIKey, "compact"}} {
		account := museAccountForUITest()
		account.Type = tc.accountType
		upstream := &grokMediaContentUpstreamStub{}
		svc := &AccountTestService{cfg: &config.Config{}, httpUpstream: upstream}
		c, _ := newTestContext()
		require.Error(t, svc.testOpenAIAccountConnection(c, account, "movie", "waves", tc.mode))
		require.Empty(t, upstream.requests)
	}
}

func TestAccountTestMuseVideoCancellationStopsPolling(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	c, rec := newTestContext()
	c.Request = c.Request.WithContext(ctx)
	upstream := &grokMediaContentUpstreamStub{}
	svc := &AccountTestService{cfg: &config.Config{}, httpUpstream: upstream}
	require.Error(t, svc.testOpenAIAccountConnection(c, museAccountForUITest(), "movie", "waves", "default"))
	require.Empty(t, upstream.requests)
	require.NotContains(t, rec.Body.String(), `"success":true`)
}

func TestAccountTestMuseVideoDeadlineStopsActivePolling(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
	defer cancel()
	c, rec := newTestContext()
	c.Request = c.Request.WithContext(ctx)
	upstream := &grokMediaContentUpstreamStub{responses: []*http.Response{
		newJSONResponse(200, `{"id":"task_1","status":"queued"}`),
		newJSONResponse(200, `{"id":"task_1","status":"processing","progress":20}`),
	}}
	svc := &AccountTestService{cfg: &config.Config{}, httpUpstream: upstream}
	require.ErrorContains(t, svc.testOpenAIAccountConnection(c, museAccountForUITest(), "movie", "waves", "default"), "task_1")
	require.Len(t, upstream.requests, 2)
	require.NotContains(t, rec.Body.String(), `"success":true`)
}
