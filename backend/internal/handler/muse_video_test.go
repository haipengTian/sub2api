//go:build unit

package handler

import (
	"context"
	"net/http"
	"testing"

	middleware "github.com/Wei-Shaw/sub2api/internal/server/middleware"
	"github.com/Wei-Shaw/sub2api/internal/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"go.uber.org/zap"
)

func TestMuseVideoCompletionBillingOnceWithCreateSnapshot(t *testing.T) {
	h, _, bindings, _ := newGrokMediaSlotHandler(t, false, false)
	c, _ := grokMediaSlotContext(context.Background(), false)
	key, ok := middleware.GetAPIKeyFromContext(c)
	require.True(t, ok)
	subject := middleware.AuthSubject{UserID: 10, Concurrency: 5}
	for _, seconds := range []int{6, 20} {
		task := "muse:task"
		if seconds == 20 {
			task = "muse:long"
		}
		require.NoError(t, h.gatewayService.StoreGrokVideoPendingBilling(context.Background(), task, 10, key.ID, service.GrokVideoPendingBilling{Model: "muse-video", BillingModel: "muse-video", UpstreamModel: "muse-video", VideoDurationSeconds: seconds, VideoResolution: "720p"}))
		for i := range 3 {
			result := &service.OpenAIForwardResult{ResponseID: task, VideoCount: 1}
			bill := prepareGrokVideoCompletionBilling(context.Background(), h, zap.NewNop(), key, subject, task, result)
			if i == 0 {
				require.NotNil(t, bill)
				require.Equal(t, "muse-video", bill.Model)
				require.Equal(t, seconds, bill.VideoDurationSeconds)
				require.Equal(t, "720p", bill.VideoResolution)
			} else {
				require.Nil(t, bill)
			}
		}
	}
	require.Len(t, bindings.billed, 2)
	require.Nil(t, prepareGrokVideoCompletionBilling(context.Background(), h, zap.NewNop(), key, subject, "muse:missing", &service.OpenAIForwardResult{ResponseID: "muse:missing", VideoCount: 1}))
	require.False(t, shouldRecordGrokMediaUsage(service.MuseVideoEndpointCreate, "muse-video", &service.OpenAIForwardResult{VideoCount: 1}))
	require.Equal(t, service.OpenAIEndpointCapabilityMuseVideo, grokMediaRequiredCapability(service.MuseVideoEndpointCreate))
}

func TestMuseVideoLookupOwnerIsolation(t *testing.T) {
	for _, other := range []string{"user", "key", "group", "task"} {
		h, slots, _, upstream := newGrokMediaSlotHandler(t, false, false)
		c, w := grokMediaSlotContext(context.Background(), false)
		key, ok := middleware.GetAPIKeyFromContext(c)
		require.True(t, ok)
		key.Group.Platform = service.PlatformOpenAI
		task := "muse:task"
		require.NoError(t, h.gatewayService.BindGrokMediaVideoRequestAccount(context.Background(), key.GroupID, task, 10, key.ID, 1))
		switch other {
		case "user":
			c.Set(string(middleware.ContextKeyUser), middleware.AuthSubject{UserID: 11, Concurrency: 5})
		case "key":
			key.ID++
		case "group":
			id := int64(25)
			key.GroupID = &id
		case "task":
			task = "muse:other"
		}
		c.Params = gin.Params{{Key: "request_id", Value: task}}
		h.MuseVideoStatus(c)
		require.Equal(t, http.StatusNotFound, w.Code, other)
		require.Zero(t, upstream.calls)
		slots.assertReleased(t)
	}
}
