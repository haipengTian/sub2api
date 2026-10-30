# 通过 Sub2API 使用 Muse 图片和视频

麦麦只配置 Sub2API 的地址和 Key，图片模型选择 `muse-image`：

```text
麦麦 → Sub2API → Muse2API → Muse
```

聊天继续使用原有模型。`muse-image` 是 Muse 图片通道，不需要伪装成 GPT 模型。

## 配置 Muse2API 上游

1. 在 Sub2API 建立 **OpenAI 兼容、API Key 类型**的上游账号，填写 Muse2API 的地址和 Key。
2. 将 `muse-image` 加入该账号的模型白名单，关联麦麦使用的分组；确认分组允许生图。
3. 将这个模型路由到 Muse2API 账号。若使用复合分组，目标平台选 OpenAI，上游模型填 `muse-image`。
4. 在账号测试中选择 `muse-image`，输入提示词测试普通生图。该操作会使用上游生成额度。
5. 麦麦图片插件继续使用 Sub2API 的 HTTPS 地址和 Key，将图片模型改为 `muse-image`。

Muse2API 账号的 Key、登录态和糯糯参考照片都保留在私有运行数据中，不放入代码或公开镜像。

## 普通画图和糯糯生活照使用不同接口

| 用途 | 请求 |
| --- | --- |
| 不含糯糯的普通画图 | `POST /v1/images/generations`，JSON |
| 保留糯糯形象的生活照 | `POST /v1/images/edits`，multipart 上传参考图 |

两类请求都使用 `model=muse-image`、`response_format=b64_json`。JSON 编辑请求也支持透传。
模型映射后仍校验上游名称；频道映射、账号映射和复合分组的上传参考图均沿用现有转发逻辑。
Muse 模型仅由 API Key 账号承接，不进入 ChatGPT OAuth / SetupToken 的原生图片工具通道。

Muse 没有内置专属价格，仍按现有图片计费配置计费。未配置渠道/分组价格且价目表无记录时，
代码沿用通用默认价（1K 为 $0.134/张），不会自动按免费处理；按你的实际用途配置价格。
图片并发、分组权限和通用图片限流保持生效。

## 上线后分别确认两种生图

普通生图成功不能代替参考图编辑验收：两条路径都需收到有效图片，并在日志中确认上游为 Muse2API。
参考图生活照还需人工检查人物一致性；网关不会替模型保证脸部一致。

麦麦现有图片客户端单次等待 180 秒，Muse2API 默认生成预算为 240 秒。上线前需对齐客户端、
Sub2API 与 nginx 的等待时间；只调 nginx 不会延长麦麦的等待时间。超时后先查询任务状态，
不要重复提交同一张图。当前麦麦插件使用同步图片接口，不会自动轮询 Muse2API 的异步任务。

Muse2API 的网页登录态和工作区也必须可用。Sub2API 能读取模型列表，不代表上游已能生成图片。

## Muse 视频：提交、轮询、下载

在同一个 Muse2API 上游账号的模型白名单中**明确加入 `muse-video`**，目标仍填 `muse-video`。
仅填写自定义地址、保持“允许所有模型”的普通 OpenAI 账号不会被当成 Muse 视频账号。
复合分组可把自己的视频别名映射到 OpenAI 平台的 `muse-video`。
分组的生图/媒体权限、并发和余额准入继续生效。

客户端使用异步流程，三步都带同一把 Sub2API Key：

1. `POST /v1/videos`（也支持 `/v1/videos/generations`），JSON 提交：

   ```json
   {"model":"muse-video","prompt":"海边日落，镜头缓缓向前","duration":6,"resolution":"720p"}
   ```

   图生视频可加 `image`、`images`、`image_url` 或 `reference_image`，使用 Muse2API 支持的 URL/data URL。
   视频接口不接收 multipart；视频编辑、延长接口仍只用于原有 Grok。

2. 用返回的完整 `id` 查询 `GET /v1/videos/{id}`。Muse ID 带 `muse:` 前缀，**不要移除**。
   网关保留 `queued`、`processing`、`completed`、`failed` 和真实 `progress`，不虚构进度。

3. 完成后调用 `GET /v1/videos/{id}/content` 下载，支持 Range。状态里的 `url`、
   `video.url`、`result.url` 都指向这个需要 Key 的网关路径，而不是无鉴权的 Muse 媒体地址。
   未完成时下载返回 409；失败后查看状态错误，不要反复重提同一个任务。

任务绑定创建它的用户、Key、分组和上游账号。查询与下载复用这份绑定，不会任意切换账号；
首次发现完成时计费，同一个任务的后续轮询和下载不重复计费。提交结果不确定时网关不自动重试，
避免重复消耗生成额度。任务查询绑定和待计费信息保存在 Redis，沿用现有 24 小时任务保留窗口。

Muse2API 未指定时长时默认提示 6 秒。本适配按请求时长记录计费，不套用 Grok 的 8 秒默认值和
15 秒上限；Muse 的时长和分辨率都是生成提示，实际成片需人工检查。计费分辨率支持
480p、720p、1080p，未指定按现有最低档 480p 计价。

**先配置 Muse 视频价格，再开放使用。** 可使用渠道按次价格，或 `muse-video` 的分组每秒价格。
没有专属价格时，系统仍会沿用通用视频兜底价（价目表也无该模型时为 $0.201/秒），不是免费。

此版本提供 Sub2API 视频接口；麦麦现有照片插件只调用图片接口，尚不会自动生成、轮询并发送视频。
后台账号的聊天/图片测试也不作为视频验收入口，视频使用上述异步 API 验收。
