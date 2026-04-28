declare namespace KScript {
  interface KDictionary {
    [key: string]: any
  }

  interface IDynamicTableObject {
    [key: string]: any
  }

  interface Request {
    [key: string]: any
  }

  interface k {
    [key: string]: any
  }
}

declare namespace Kooboo.KContent {
  interface KContentInstance {
    [key: string]: any
  }
}

declare module "module:sqlite_orm" {
  export function createModel(...args: any[]): any
}
