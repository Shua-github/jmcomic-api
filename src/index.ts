import { Context, Schema, Logger, h, Session, HTTP } from 'koishi';

export const name = 'jmcomic-api';

export interface Config {
  apiUrl: string;
  getDataMethod: any
}

export const Config: Schema<Config> = Schema.object({
  apiUrl: Schema.string().description('API 地址(注意末尾不要带 / )'),
  getDataMethod: Schema.union([
    Schema.const('base64').description('base64'),
    Schema.const('from-data').description('from-data'),
  ]).default("base64").description('获取数据的方式'),
});

export const inject = ['http']

const logger = new Logger(name);
export let usage = `
<a href="https://github.com/Shua-github/jmcomic-api" target="_blank">本插件仓库</a> <br>
<a href="https://github.com/Shua-github/JMComic-API-Python" target="_blank">后端仓库</a> <br>
使用前请部署后端 API 服务。<br>
在终端中执行以下命令：<br>
pip install jmcomic_api<br>
python -m jmcomic_api<br> 
然后在配置文件中填写 API 地址。<br>
注意,base64小概率发不出去,但是速度通常更快,from-data比较稳定,但是速度可能比base64慢,出现问题时请先尝试切换from-data。<br>
`
export function apply(ctx: Context, config: Config) {
  ctx.command('jm.info <jm_id:number>','获取本子信息')
    .alias('jm.信息')
    .action(async ({ session, options }, jm_id) => {
      if (!jm_id) return '请提供有效的本子 ID！';
      const apiUrl = `${config.apiUrl}/get/raw?jm_id=${jm_id}&types=info`;
      try {
        const raw_resp = await ctx.http(apiUrl);
        let data = raw_resp.data;
        data = data['data']['raw_info'];
        const comment_count = data['comment_count']; // 评论数
        const likes = data['likes']; // 点赞数
        const tags = data['tags']; // 标签
        const views = data['views']; // 浏览量

        const text = `车牌号：${jm_id}
评论数: ${comment_count}
点赞数: ${likes}
标签: ${tags}
浏览量: ${views}`.trim();
        return text;
      } catch (error) {
        if (HTTP.Error.is(error)) {
          const response = error.response;
          let data = response.data['data'];
          if (response.status === 400) {
            logger.error(`出现错误: ${data['log']}`);
            return h.text(data['msg']);
          } else {
            throw error; // 其他错误继续抛出
          }
        }
        throw error; // 其他错误继续抛出
      }
    })
  ctx.command('jm.get <jm_id:number> [file_type:string]', '获取本子文件 (PDF/ZIP)')
    .alias('jm.获取')
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
      logger.debug(`请求的URL: ${apiUrl}, pwd: ${password}`);

      if (config.getDataMethod === 'base64') {
        try {
          const response: HTTP.Response<any> = await ctx.http(apiUrl);
          const data = response.data['data'];
          if (data?.file) {
            const buffer = Buffer.from(data.file, 'base64');
            return h.file(buffer, file_type, { title: `${jm_id}.${file_type}` });
          }
          logger.error('API 返回的数据缺少必要的信息:', data);
          return '获取本子信息失败，文件信息不完整。';
        } catch (error) {
          if (HTTP.Error.is(error)) {
            const response = error.response;
            let data = response.data['data'];
            if (response.status === 400) {
              logger.error(`出现错误: ${data['log']}`);
              return h.text(data['msg']);
            } else {
              throw error; // 其他错误继续抛出
            }
          }
          throw error; // 其他错误继续抛出
        }
      }

      if (config.getDataMethod === 'from-data') {
        try {
          const response = await ctx.http(apiUrl, { responseType: 'arraybuffer' });
          const data = Buffer.isBuffer(response.data) ? response.data : Buffer.from(response.data);
          return h.file(data, file_type, { title: `${jm_id}.${file_type}` });
        } catch (error) {
          if (HTTP.Error.is(error)) {
            const response = error.response;
            let data = response.data['data'];
            if (response.status === 400) {
              logger.error(`出现错误: ${data['log']}`);
              return h.text(data['msg']);
            }
            else {
              throw error; // 其他错误继续抛出
            }
          }
          throw error; // 其他错误继续抛出
        }
      }
    }
  );
}
