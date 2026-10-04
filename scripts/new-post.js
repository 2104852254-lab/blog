/* This is a script to create a new post markdown file with front-matter */

import fs from "fs"
import path from "path"
import { pinyin } from "pinyin-pro"

function getDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

const args = process.argv.slice(2)

if (args.length === 0 || (args.length !== 1 && !(args.length === 3 && args[1] === "--title"))) {
  console.error(`Error: No filename argument provided
Usage: pnpm new-post <filename> [--title "文章标题"]`)
  process.exit(1) // Terminate the script and return error code 1
}

let fileName = args[0]
const title = args.length === 3 ? args[2] : args[0]

// Validate before making directories. Use forward slashes for nested posts.
const segments = fileName.split("/")
if (
	!title.trim() ||
	/^\.mdx?$/i.test(segments.at(-1)) ||
	segments.some((segment) =>
		!segment.trim() || segment === "." || segment === ".." ||
		/[<>:"\\|?*\x00-\x1f\x7f]/.test(segment) ||
		/[. ]$/.test(segment) ||
		/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment)
	)
) {
	console.error("Error: Use a safe relative filename inside src/content/posts and a non-empty title.")
	process.exit(1)
}

// Add .md extension if not present
const fileExtensionRegex = /\.(md|mdx)$/i
if (!fileExtensionRegex.test(fileName)) {
  fileName += ".md"
}

const targetDir = "./src/content/posts/"
const fullPath = path.join(targetDir, fileName)

// Refuse symlinks/junctions in the author path, including the posts directory.
let current = process.cwd()
for (const segment of ["src", "content", "posts", ...segments.slice(0, -1)]) {
	current = path.join(current, segment)
	if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
		console.error("Error: Post directories must not be symlinks or junctions.")
		process.exit(1)
	}
}

// Generate slug from filename: strip extension, strip trailing /index
let slug = fileName.replace(fileExtensionRegex, "")
if (slug.endsWith("/index")) {
  slug = slug.slice(0, -"/index".length)
}

// Convert Chinese characters to pinyin, keep other chars as-is
slug = slug
  .split("/")
  .map((segment) => {
    if (!/[一-鿿]/.test(segment)) return segment
    // Process character by character: Chinese → pinyin, others → keep
    const chars = [...segment]
    const parts = []
    let buf = ""
    for (const ch of chars) {
      if (/[一-鿿]/.test(ch)) {
        if (buf) { parts.push(buf); buf = "" }
        parts.push(pinyin(ch, { toneType: "none", type: "array" })[0])
      } else {
        buf += ch
      }
    }
    if (buf) parts.push(buf)
    return parts
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
  })
  .join("/")

if (fs.existsSync(fullPath)) {
  console.error(`Error: File ${fullPath} already exists `)
  process.exit(1)
}

// recursive mode creates multi-level directories
const dirPath = path.dirname(fullPath)
if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
}

const content = `---
title: ${JSON.stringify(title)}
published: ${getDate()}
description: ''
image: ''
lightImage: ''
tags: []
category: ''
draft: true
lang: ''
author: '守夜人'
slug: ${JSON.stringify(slug)}
---
`

try {
	// Exclusive creation protects a draft if another process creates it first.
	fs.writeFileSync(fullPath, content, { flag: "wx" })
} catch (error) {
	console.error(`Error: Could not create post: ${error.message}`)
	process.exit(1)
}

console.log(`Post ${fullPath} created`)
