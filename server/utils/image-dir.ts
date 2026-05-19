/**
 * ============================================================
 *  图片目录工具
 *  在生产和开发环境返回正确的 public/images 路径
 *  生产环境 (nuxt build)：.output/public/images/
 *  开发环境 (nuxt dev)：public/images/
 * ============================================================
 */
import { join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

/**
 * 获取正确的 public/images 目录路径
 * 自动检测生产/开发环境并返回实际提供静态文件服务的目录
 */
export function getPublicImagesDir(): string {
  const cwd = process.cwd()
  const buildDir = join(cwd, '.output', 'public', 'images')
  const sourceDir = join(cwd, 'public', 'images')

  // 生产环境：.output/public/ 存在则优先使用
  if (existsSync(buildDir)) return buildDir

  // 开发环境或首次运行：使用源目录
  if (!existsSync(sourceDir)) {
    mkdirSync(sourceDir, { recursive: true })
  }
  return sourceDir
}
