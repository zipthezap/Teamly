const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

// Performance configuration - configurable via environment variable
const MAX_BUNDLE_SIZE = parseInt(process.env.MAX_BUNDLE_SIZE || '2000000', 10); // Default 2MB - reasonable for a React SPA

module.exports = {
  mode: 'production',
  entry: './src/index.tsx',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.[contenthash].js',
    clean: true,
    publicPath: '/',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: {
          loader: 'ts-loader',
          options: {
            // Skip type checking for faster builds
            // Note: Type checking should be done separately via 'tsc --noEmit' 
            // in CI/CD pipeline or during development
            transpileOnly: true,
          },
        },
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      // Use separate template for webpack builds (without Vite-specific script tags)
      template: './index.webpack.html',
      inject: 'body',
      filename: 'index.html',
    }),
  ],
  performance: {
    maxEntrypointSize: MAX_BUNDLE_SIZE,
    maxAssetSize: MAX_BUNDLE_SIZE,
  },
};
