package service

import (
	"context"
	"encoding/json"
	"regexp"
	"strconv"
	"strings"
	"time"

	infraerrors "github.com/Wei-Shaw/sub2api/internal/pkg/errors"
)

const customGitHubRepo = "haipengTian/sub2api"

var customVersionPattern = regexp.MustCompile(`^v?(\d+)\.(\d+)\.(\d+)-custom\.([1-9]\d*)$`)
var ErrManagedCustomUpdate = infraerrors.Conflict("CUSTOM_UPDATE_MANAGED", "custom deployments must use server-ops update.sh or rollback.sh with a published personal image")

// CustomSyncState is published by the repository workflow, never by the production server.
type CustomSyncState struct {
	UpstreamTag string   `json:"upstream_tag"`
	Status      string   `json:"status"`
	Branch      string   `json:"branch,omitempty"`
	RunURL      string   `json:"run_url,omitempty"`
	Conflicts   []string `json:"conflicts,omitempty"`
}

type customSyncReader interface {
	FetchCustomSyncState(context.Context) (*CustomSyncState, error)
}
type customUpdateCache struct {
	Source    string     `json:"source"`
	Timestamp int64      `json:"timestamp"`
	Info      UpdateInfo `json:"info"`
}

func (s *UpdateService) isCustomBuild() bool { return strings.Contains(s.currentVersion, "-custom.") }

func compareCustomVersions(a, b string) int {
	if base := compareVersions(a, b); base != 0 {
		return base
	}
	revision := func(v string) int {
		m := customVersionPattern.FindStringSubmatch(v)
		if m == nil {
			return 0
		}
		n, _ := strconv.Atoi(m[4])
		return n
	}
	x, y := revision(a), revision(b)
	if x < y {
		return -1
	}
	if x > y {
		return 1
	}
	return 0
}

func (s *UpdateService) checkCustomUpdate(ctx context.Context, force bool) (*UpdateInfo, error) {
	// Separate cache schema/source prevents an older official-release cache from re-enabling updates.
	readCache := func() *UpdateInfo {
		raw, err := s.cache.GetUpdateInfo(ctx)
		if err != nil {
			return nil
		}
		var cached customUpdateCache
		if json.Unmarshal([]byte(raw), &cached) != nil || cached.Source != customGitHubRepo || cached.Info.CurrentVersion != s.currentVersion || time.Now().Unix()-cached.Timestamp > updateCacheTTL {
			return nil
		}
		cached.Info.Cached = true
		return &cached.Info
	}
	if !force {
		if cached := readCache(); cached != nil {
			return cached, nil
		}
	}
	info := &UpdateInfo{CurrentVersion: s.currentVersion, LatestVersion: s.currentVersion, BuildType: s.buildType, UpdateChannel: "custom", CustomSync: &CustomSyncState{Status: "unknown"}}
	releases, err := s.githubClient.FetchRecentReleases(ctx, customGitHubRepo, 100)
	if err != nil {
		if cached := readCache(); cached != nil {
			cached.Warning = "Custom release check unavailable; using cached data"
			return cached, nil
		}
		info.Warning = "Custom release check unavailable"
	} else {
		for _, release := range releases {
			// custom releases intentionally have GitHub prerelease=true; draft/official/rc tags are excluded.
			if release == nil || release.Draft || !customVersionPattern.MatchString(release.TagName) {
				continue
			}
			version := strings.TrimPrefix(release.TagName, "v")
			if compareCustomVersions(info.LatestVersion, version) < 0 {
				info.LatestVersion = version
				info.ReleaseInfo = &ReleaseInfo{Name: release.Name, Body: release.Body, PublishedAt: release.PublishedAt, HTMLURL: release.HTMLURL}
			}
		}
		info.HasUpdate = compareCustomVersions(s.currentVersion, info.LatestVersion) < 0
		if info.HasUpdate {
			info.CustomImage = "ghcr.io/haipengtian/sub2api:" + info.LatestVersion
		}
	}
	upstream, upErr := s.githubClient.FetchLatestRelease(ctx, githubRepo)
	if upErr == nil && upstream != nil && !upstream.Draft && !upstream.Prerelease {
		info.UpstreamVersion = strings.TrimPrefix(upstream.TagName, "v")
		if err == nil {
			info.CustomSync.Status = "up_to_date"
			if compareVersions(info.LatestVersion, info.UpstreamVersion) < 0 {
				info.CustomSync.Status = "waiting"
			}
		}
	} else {
		if info.Warning != "" {
			info.Warning += "; "
		}
		info.Warning += "Upstream release check unavailable"
	}
	if reader, ok := s.githubClient.(customSyncReader); ok {
		state, stateErr := reader.FetchCustomSyncState(ctx)
		if err == nil && stateErr == nil && state != nil && strings.TrimPrefix(state.UpstreamTag, "v") == info.UpstreamVersion && compareVersions(info.LatestVersion, info.UpstreamVersion) < 0 {
			switch state.Status {
			case "conflict", "manual_review", "checking", "publishing", "checks_failed", "publish_failed":
				info.CustomSync = state
			}
		}
	}
	if err == nil && upErr == nil {
		raw, _ := json.Marshal(customUpdateCache{Source: customGitHubRepo, Timestamp: time.Now().Unix(), Info: *info})
		_ = s.cache.SetUpdateInfo(ctx, string(raw), time.Duration(updateCacheTTL)*time.Second)
	}
	return info, nil
}
