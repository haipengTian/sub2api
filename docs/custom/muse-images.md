# 麦麦通过 Sub2API 使用 Muse 生图

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

## 上线后分别确认两种生图

普通生图成功不能代替参考图编辑验收：两条路径都需收到有效图片，并在日志中确认上游为 Muse2API。
参考图生活照还需人工检查人物一致性；网关不会替模型保证脸部一致。

麦麦现有图片客户端单次等待 180 秒，Muse2API 默认生成预算为 240 秒。上线前需对齐客户端、
Sub2API 与 nginx 的等待时间；只调 nginx 不会延长麦麦的等待时间。超时后先查询任务状态，
不要重复提交同一张图。当前麦麦插件使用同步图片接口，不会自动轮询 Muse2API 的异步任务。

Muse2API 的网页登录态和工作区也必须可用。Sub2API 能读取模型列表，不代表上游已能生成图片。
