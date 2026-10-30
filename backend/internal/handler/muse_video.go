package handler

import (
	"errors"
	"mime"
	"net/http"

	pkghttputil "github.com/Wei-Shaw/sub2api/internal/pkg/httputil"
	"github.com/Wei-Shaw/sub2api/internal/pkg/requestmodel"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

func (h *OpenAIGatewayHandler) MuseVideoGeneration(c *gin.Context) {
	body, err := pkghttputil.ReadRequestBodyWithPrealloc(c.Request)
	if err != nil {
		status := http.StatusBadRequest
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			status = http.StatusRequestEntityTooLarge
		}
		h.errorResponse(c, status, "invalid_request_error", "Failed to read request body")
		return
	}
	requestmodel.ResetRequestBody(c.Request, body)
	if !service.IsMuseVideoModel(gjson.GetBytes(body, "model").String()) {
		h.errorResponse(c, http.StatusNotFound, "not_found_error", "Videos API is not supported for this platform")
		return
	}
	mediaType, _, err := mime.ParseMediaType(c.GetHeader("Content-Type"))
	if err != nil || mediaType != "application/json" {
		h.errorResponse(c, http.StatusUnsupportedMediaType, "invalid_request_error", "Muse video requires application/json")
		return
	}
	h.handleGrokMedia(c, service.MuseVideoEndpointCreate, "")
}

func (h *OpenAIGatewayHandler) MuseVideoStatus(c *gin.Context) {
	h.handleGrokMedia(c, service.MuseVideoEndpointStatus, c.Param("request_id"))
}

func (h *OpenAIGatewayHandler) MuseVideoContent(c *gin.Context) {
	h.handleGrokMedia(c, service.MuseVideoEndpointContent, c.Param("request_id"))
}
