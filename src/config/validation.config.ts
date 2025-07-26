import { ValidationPipeOptions } from '@nestjs/common';

export const validationConfig: ValidationPipeOptions = {
  transform: true, // 自动转换类型
  transformOptions: {
    enableImplicitConversion: true, // 启用隐式转换
  },
  whitelist: true, // 去除未定义的属性
  forbidNonWhitelisted: false, // 禁止未定义的属性
  skipMissingProperties: false, // 不跳过缺失的属性
  skipNullProperties: false, // 不跳过 null 属性
  skipUndefinedProperties: false, // 不跳过 undefined 属性
};
