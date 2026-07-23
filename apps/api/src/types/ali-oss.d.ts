declare module 'ali-oss' {
  export interface OssOptions {
    region: string;
    accessKeyId: string;
    accessKeySecret: string;
    authorizationV4: boolean;
    bucket: string;
    secure: boolean;
  }
  export default class OSS {
    constructor(options: OssOptions);
    put(name: string, file: Buffer, options: { headers: Record<string, string> }): Promise<unknown>;
  }
}
