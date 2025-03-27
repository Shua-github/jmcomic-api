import { AnyARecord } from 'dns';
import { Context, Schema, Logger, h, Session, HTTP } from 'koishi';

export const name = 'jmcomic-api';

export interface Config {
  apiUrl: string;
  getDataMethod: any
}

export const Config: Schema<Config> = Schema.object({
  apiUrl: Schema.string().description('API 地址(注意末尾不要带 / )'),
  getDataMethod: Schema.union([
    Schema.const('base64').description('base64(可能会发不出去)'),
    Schema.const('from-data').description('from-data'),
  ]).default("from-data").description('获取数据的方式'),
});

const logger = new Logger(name);
export let usage = `
使用前请部署后端 API 服务。<br>
在终端中执行以下命令：<br>
pip install jmcomic_api<br>
python -m jmcomic_api<br> 
然后在配置文件中填写 API 地址。<br>
`
export function apply(ctx: Context, config: Config) {
  ctx.command('jm-info <jm_id:number>','获取本子信息')
    .alias('本子信息')
    .action(async ({ session, options }, jm_id) => {
      const apiUrl = `${config.apiUrl}/get/raw?jm_id=${jm_id}&types=info`
      let data = await ctx.http.get(apiUrl)
      logger.info(JSON.stringify(data))
      data = data['data']['raw_info']
      const comment_count = data['comment_count'] // 评论数
      const likes = data['likes'] // 点赞数
      const tags = data['tags'] // 标签
      const views = data['views'] // 浏览量

      const text = `评论数: ${comment_count}
点赞数: ${likes}
标签: ${tags}
浏览量: ${views}`.trim();
      return text;
    })
  ctx.command('jm <jm_id:number> [file_type:string]', '获取本子文件 (PDF/ZIP)')
    .alias('本子')
    .option('type', '-t <file_type:string>', { fallback: 'pdf' })
    .option('password', '-p <password:string>', { fallback: null })
    .option('noCache', '-c <no_cache:boolean>', { fallback: false })
    .action(async ({ session, options }, jm_id, file_type, password) => {
      file_type = file_type || options.type;
      password = password || options.password;
      if (!jm_id) return '请提供有效的本子 ID！';

      const validTypes = ['pdf', 'zip'];
      if (!validTypes.includes(file_type)) return '文件类型无效，请选择 pdf 或 zip。';

      const no_cache = options.noCache ? 'true' : 'false';
      const apiUrl = `${config.apiUrl}/get/file?jm_id=${jm_id}&file_type=${file_type}&no_cache=${no_cache}&return_method=${config.getDataMethod}`
        + (password ? `&file_pwd=${password}` : '');
      logger.debug(`请求的URL:${apiUrl},pwd:${password}`);
      if (config.getDataMethod === 'base64') {
        const response: HTTP.Response<any> = await ctx.http.get(apiUrl);
        const data = response.data;

        if (data?.file) {
          const buffer = Buffer.from(data.file, 'base64');
          return h.file(buffer, `${jm_id}.${file_type}`);
        }
        logger.error('API 返回的数据缺少必要的信息:', data);
        return '获取本子信息失败，文件信息不完整。';
      }

      if (config.getDataMethod === 'from-data') {
        return h.file(apiUrl,{ title: `${jm_id}.${file_type}`});
      }
    });
}
