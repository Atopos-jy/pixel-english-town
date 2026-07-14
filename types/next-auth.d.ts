import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * 扩展Session接口以包含role字段
   */
  interface Session extends DefaultSession {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  /**
   * 扩展User接口以包含role字段
   */
  interface User extends DefaultUser {
    role: string;
  }
}

declare module "next-auth/jwt" {
  /**
   * 扩展JWT接口以包含role字段
   */
  interface JWT extends DefaultJWT {
    id: string;
    role: string;
  }
}
