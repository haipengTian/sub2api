package routes

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/stretchr/testify/require"
)

func TestMuseVideoRoutes(t *testing.T) {
	for _, platform := range []string{service.PlatformOpenAI, service.PlatformComposite} {
		router := newGatewayRoutesTestRouter(platform)
		for _, prefix := range []string{"/v1", ""} {
			for _, suffix := range []string{"/videos", "/videos/generations"} {
				req := httptest.NewRequest(http.MethodPost, prefix+suffix, strings.NewReader(`{"model":"muse-video","prompt":"waves"}`))
				req.Header.Set("Content-Type", "application/json")
				w := httptest.NewRecorder()
				router.ServeHTTP(w, req)
				require.NotEqual(t, http.StatusNotFound, w.Code, platform+prefix+suffix)
			}
			for _, suffix := range []string{"/videos/muse:task-1", "/videos/muse:task-1/content", "/videos/generations/muse:task-1", "/videos/generations/muse:task-1/content"} {
				w := httptest.NewRecorder()
				router.ServeHTTP(w, httptest.NewRequest(http.MethodGet, prefix+suffix, nil))
				require.NotEqual(t, http.StatusNotFound, w.Code, platform+prefix+suffix)
			}
		}
	}
}
