import path from 'node:path';
import {
  HtmlRspackPlugin,
  LightningCssMinimizerRspackPlugin,
  SwcJsMinimizerRspackPlugin,
  type Configuration,
} from '@rspack/core';

interface RspackArgs {
  mode?: 'development' | 'production' | 'none';
}

export default (_env: unknown, argv: RspackArgs): Configuration => {
  const mode = argv.mode ?? 'development';
  const isProduction = mode === 'production';

  return {
    mode,
    entry: './src/index.ts',
    output: {
      path: path.resolve(process.cwd(), 'dist'),
      filename: 'bundle.js',
      clean: true,
    },
    resolve: {
      extensions: ['.ts', '.js'],
    },
    module: {
      rules: [
        {
          test: /\.ts$/,
          use: {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: { syntax: 'typescript' },
                target: 'es2022',
              },
            },
          },
          type: 'javascript/auto',
        },
        {
          test: /\.css$/,
          type: 'css',
        },
      ],
    },
    plugins: [
      new HtmlRspackPlugin({
        template: './src/index.html',
      }),
    ],
    devtool: isProduction ? false : 'cheap-module-source-map',
    // 指定 optimization.minimizer 会覆盖默认值，故 JS 与 CSS 的 minimizer 必须同时列出
    ...(isProduction
      ? {
          optimization: {
            minimizer: [
              new SwcJsMinimizerRspackPlugin(),
              new LightningCssMinimizerRspackPlugin(),
            ],
          },
        }
      : {}),
    experiments: {
      css: true,
    },
    devServer: {
      port: 8080,
      hot: true,
      open: false,
      client: {
        overlay: true,
      },
    },
  };
};
