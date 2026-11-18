//go:build unit

package handler

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"testing/iotest"

	pkghttputil "github.com/Wei-Shaw/sub2api/internal/pkg/httputil"
	"github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestMuseVideoGenerationRequestBodyFailures(t *testing.T) {
	for _, tc := range []struct {
		name       string
		body       io.Reader
		budget     int64
		limit      int64
		wantStatus int
		wantText   string
		wantRetry  string
	}{
		{"budget", strings.NewReader(`{"model":"muse-video","prompt":"waves"}`), 1, 1024, http.StatusServiceUnavailable, "Request body buffering capacity is exhausted", "1"},
		{"timeout", iotest.ErrReader(os.ErrDeadlineExceeded), 1024, 1024, http.StatusRequestTimeout, "Timed out reading request body", ""},
		{"truncated", iotest.ErrReader(io.ErrUnexpectedEOF), 1024, 1024, http.StatusBadRequest, "Failed to read request body", ""},
		{"too large", strings.NewReader(`{"model":"muse-video"}`), 65536, 1, http.StatusRequestEntityTooLarge, "Request body is too large", ""},
	} {
		t.Run(tc.name, func(t *testing.T) {
			router := gin.New()
			router.Use(middleware.RequestBodyLimit(tc.limit, pkghttputil.NewBodyMemoryBudget(tc.budget)))
			router.Use(func(c *gin.Context) {
				c.Set(string(middleware.ContextKeyAPIKey), &service.APIKey{
					Group: &service.Group{Platform: service.PlatformOpenAI},
				})
				c.Next()
			})
			// An OpenAI group without an allowlist leaves reading to Muse's handler.
			router.Use(middleware.GroupModelAllowlist())
			h := &OpenAIGatewayHandler{}
			router.POST("/v1/videos", h.MuseVideoGeneration)
			req := httptest.NewRequest(http.MethodPost, "/v1/videos", nil)
			req.Body = io.NopCloser(tc.body)
			req.Header.Set("Content-Type", "application/json")
			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			require.Equal(t, tc.wantStatus, rec.Code, rec.Body.String())
			require.Contains(t, rec.Body.String(), tc.wantText)
			require.Equal(t, tc.wantRetry, rec.Header().Get("Retry-After"))
		})
	}
}
