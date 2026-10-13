//go:build unit

package service

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

type customUpdateClient struct {
	updateServiceGitHubClientStub
	state *CustomSyncState
	repos []string
}

func (c *customUpdateClient) FetchLatestRelease(ctx context.Context, repo string) (*GitHubRelease, error) {
	c.repos = append(c.repos, repo)
	return c.release, nil
}
func (c *customUpdateClient) FetchRecentReleases(ctx context.Context, repo string, n int) ([]*GitHubRelease, error) {
	c.repos = append(c.repos, repo)
	return c.recentReleases, c.recentErr
}
func (c *customUpdateClient) FetchCustomSyncState(context.Context) (*CustomSyncState, error) {
	return c.state, nil
}

func TestCustomUpdateNeverInstallsUpstreamBinary(t *testing.T) {
	c := &customUpdateClient{updateServiceGitHubClientStub: updateServiceGitHubClientStub{release: &GitHubRelease{TagName: "v0.2.16"}}, state: &CustomSyncState{UpstreamTag: "v0.2.16", Status: "conflict"}}
	s := NewUpdateService(&updateServiceCacheStub{}, c, "0.2.15-custom.1", "release")
	info, err := s.CheckUpdate(context.Background(), true)
	require.NoError(t, err)
	require.False(t, info.HasUpdate)
	require.Equal(t, "0.2.15-custom.1", info.LatestVersion)
	require.Equal(t, "0.2.16", info.UpstreamVersion)
	require.Equal(t, "conflict", info.CustomSync.Status)
	require.Equal(t, "custom", info.UpdateChannel)
	require.ErrorIs(t, s.PerformUpdate(context.Background()), ErrManagedCustomUpdate)
	require.ErrorIs(t, s.Rollback(), ErrManagedCustomUpdate)
	require.ErrorIs(t, s.RollbackToVersion(context.Background(), "0.2.14"), ErrManagedCustomUpdate)
	versions, err := s.ListRollbackVersions(context.Background())
	require.NoError(t, err)
	require.Empty(t, versions)
	require.Contains(t, c.repos, customGitHubRepo)
}

func TestCustomUpdateIncludesPublishedCustomPrereleasesAndRevision(t *testing.T) {
	c := &customUpdateClient{updateServiceGitHubClientStub: updateServiceGitHubClientStub{
		release: &GitHubRelease{TagName: "v0.2.16"}, recentReleases: []*GitHubRelease{
			{TagName: "v0.2.15-custom.2", Prerelease: true},
			{TagName: "v0.2.17-custom.1", Draft: true},
			{TagName: "v0.2.18"},
		}}}
	s := NewUpdateService(&updateServiceCacheStub{}, c, "0.2.15-custom.1", "release")
	info, err := s.CheckUpdate(context.Background(), true)
	require.NoError(t, err)
	require.True(t, info.HasUpdate)
	require.Equal(t, "0.2.15-custom.2", info.LatestVersion)
	require.Equal(t, "waiting", info.CustomSync.Status) // upstream 0.2.16 is still waiting
	require.Contains(t, info.CustomImage, ":0.2.15-custom.2")
}

func TestCustomUpdateCacheCannotReuseOfficialOrPreviousCurrent(t *testing.T) {
	cache := &updateServiceCacheStub{data: `{"latest":"0.2.99","timestamp":9999999999}`}
	c := &customUpdateClient{updateServiceGitHubClientStub: updateServiceGitHubClientStub{release: &GitHubRelease{TagName: "v0.2.16"}}}
	s := NewUpdateService(cache, c, "0.2.15-custom.1", "release")
	info, err := s.CheckUpdate(context.Background(), false)
	require.NoError(t, err)
	require.False(t, info.HasUpdate)
	require.Equal(t, "waiting", info.CustomSync.Status)
}

func TestCustomUpdatePersonalAPIFailureDoesNotClaimUpToDate(t *testing.T) {
	c := &customUpdateClient{updateServiceGitHubClientStub: updateServiceGitHubClientStub{
		release: &GitHubRelease{TagName: "v0.2.16"}, recentErr: errors.New("unavailable"),
	}}
	s := NewUpdateService(&updateServiceCacheStub{}, c, "0.2.16-custom.1", "release")
	info, err := s.CheckUpdate(context.Background(), true)
	require.NoError(t, err)
	require.False(t, info.HasUpdate)
	require.Equal(t, "unknown", info.CustomSync.Status)
	require.Contains(t, info.Warning, "Custom release check unavailable")
}

func TestCustomUpdateSameBaseRevisionAndStaleSyncState(t *testing.T) {
	c := &customUpdateClient{updateServiceGitHubClientStub: updateServiceGitHubClientStub{
		release: &GitHubRelease{TagName: "v0.2.16"}, recentReleases: []*GitHubRelease{
			{TagName: "v0.2.16-custom.10", Prerelease: true}, {TagName: "v0.2.16-custom.2", Prerelease: true},
		},
	}, state: &CustomSyncState{UpstreamTag: "v0.2.15", Status: "conflict"}}
	s := NewUpdateService(&updateServiceCacheStub{}, c, "0.2.16-custom.9", "release")
	info, err := s.CheckUpdate(context.Background(), true)
	require.NoError(t, err)
	require.True(t, info.HasUpdate)
	require.Equal(t, "0.2.16-custom.10", info.LatestVersion)
	require.Equal(t, "up_to_date", info.CustomSync.Status)
}
