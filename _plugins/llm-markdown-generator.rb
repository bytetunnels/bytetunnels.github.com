# Generates a raw-markdown copy of every post at /posts/<slug>.md so LLM
# crawlers (GPTBot, ClaudeBot, PerplexityBot, etc.) can fetch clean source
# content without HTML stripping. Pattern follows Anthropic, Stripe, Vercel,
# and Cloudflare docs.
require "fileutils"

Jekyll::Hooks.register :site, :post_write do |site|
  dest = site.dest
  site_url = site.config["url"].to_s
  author_name = site.config.dig("social", "name").to_s
  author_email = site.config.dig("social", "email").to_s
  social_links = Array(site.config.dig("social", "links"))

  site.posts.docs.each do |post|
    # Derive slug from URL (permalink is /posts/:title/)
    slug = post.url.sub(%r{^/posts/}, "").sub(%r{/$}, "")
    next if slug.empty?

    md_path = File.join(dest, "posts", "#{slug}.md")
    FileUtils.mkdir_p(File.dirname(md_path))

    # Read raw source body (skip frontmatter)
    raw = File.read(post.path, encoding: "UTF-8")
    body = raw.sub(/\A---\s*\n.*?\n---\s*\n/m, "")

    title = post.data["title"].to_s
    canonical = "#{site_url}#{post.url}"
    date_str = post.date.strftime("%Y-%m-%d")
    categories = Array(post.data["categories"])
    tags = Array(post.data["tags"])
    description = post.data["description"].to_s.strip
    image_path = post.data.dig("image", "path") || post.data["image"]

    front = []
    front << "---"
    front << "title: #{title.inspect}"
    front << "canonical_url: #{canonical}"
    front << "date: #{date_str}"
    front << "author: #{author_name.inspect}"
    front << "author_email: #{author_email.inspect}" unless author_email.empty?
    front << "author_links: #{social_links.inspect}" unless social_links.empty?
    front << "categories: #{categories.inspect}"
    front << "tags: #{tags.inspect}"
    front << "description: #{description.inspect}" unless description.empty?
    if image_path && !image_path.to_s.empty?
      img = image_path.to_s
      img = "#{site_url}#{img}" if img.start_with?("/")
      front << "image: #{img.inspect}"
    end
    front << "site: #{site.config["title"].to_s.inspect}"
    front << "site_url: #{site_url.inspect}"
    front << "license: #{site.config["license"].to_s.inspect}" if site.config["license"]
    front << "license_name: #{site.config["license_name"].to_s.inspect}" if site.config["license_name"]
    front << "---"
    front << ""

    File.write(md_path, front.join("\n") + "\n" + body, encoding: "UTF-8")
  end

  Jekyll.logger.info "LLM Markdown:", "Generated #{site.posts.docs.size} /posts/<slug>.md files"
end
