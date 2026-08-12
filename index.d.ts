declare function pumlForMarkdown(
  options?: pumlForMarkdown.RunOptions,
): Promise<pumlForMarkdown.RunResult>

declare namespace pumlForMarkdown {
  type ImageFormat = 'png' | 'svg'
  type ImageFormats = ImageFormat | 'both' | readonly ImageFormat[]
  type LinkMode = 'local' | 'server' | 'tinyurl'
  type PathSelection = readonly string[]

  interface RunOptions {
    rootDirectory?: string
    pumlDirectory?: string
    markdownDirectory?: string
    distDirectory?: string
    outputImages?: boolean
    imageFormats?: ImageFormats
    pumlServerUrl?: string
    linkMode?: LinkMode
    localImageFormat?: ImageFormat
    regenerateAll?: boolean
    deleteOrphanImages?: boolean
    markerPattern?: string | RegExp
    markerFlags?: string
    respectGitignore?: boolean
    gitignorePath?: string

    /** Omitted means full scan; an empty array means select none. */
    pumlFiles?: PathSelection
    /** Omitted means full scan; an empty array means select none. */
    markdownFiles?: PathSelection

    /** @deprecated Use linkMode: 'server'. */
    shouldShortenLinks?: boolean
    fetchBuffer?: (url: string) => Promise<Uint8Array>
    shortener?: (url: string) => Promise<string>
  }

  interface ProjectConfig extends RunOptions {
    changedFilesStdin0?: boolean
    hotReload?: boolean
    intervalSeconds?: number
  }

  interface MarkdownResult {
    content: string
    processedLinks: number
    changed: boolean
  }

  interface RunResult {
    rootDirectory: string
    pumlDirectory: string
    markdownDirectory: string
    distDirectory: string
    selectedPuml: string[]
    selectedMarkdown: string[]
    generatedImages: string[]
    removedImages: string[]
    skippedAuxiliary: string[]
    markdownResults: MarkdownResult[]
  }

  interface LoadProjectConfigOptions {
    explicitPath?: string
    searchDirectory?: string
  }

  interface LoadedConfig {
    config: ProjectConfig
    configPath?: string
    configDirectory: string
  }

  interface IncludeDeclaration {
    kind: 'include' | 'include_once' | 'include_many'
    declaration: string
    target: string
    path: string
  }

  interface IncludeGraph {
    nodes: Map<string, Set<string>>
    reverse: Map<string, Set<string>>
  }

  interface ProcessedPumlContent {
    data: string
    encodedData: string
    url?: string
  }

  interface IncludesApi {
    affectedConsumers(changedPaths: string[], reverseGraph: Map<string, Set<string>>): Set<string>
    assertAllowedInclude(includePath: string, allowedDirectory?: string): string
    buildIncludeGraph(pumlPaths: string[], options?: { pumlDirectory?: string }): IncludeGraph
    expandIncludes(sourcePath: string, options?: { pumlDirectory?: string }): string
    parseLocalIncludes(sourcePath: string, data: string): IncludeDeclaration[]
  }

  interface MarkdownApi {
    DEFAULT_MARKER_PATTERN: string
    codeRanges(markdown: string): Array<[number, number]>
    createMarkerRegex(markerPattern?: string | RegExp, markerFlags?: string): RegExp
    processMarkdownFile(options: {
      markdownPath: string
      pumlDirectory: string
      distDirectory: string
      localImageFormat: ImageFormat
      linkMode: LinkMode
      markerPattern?: string | RegExp
      markerFlags?: string
      resolveServerLink(sourcePath: string): Promise<string>
    }): Promise<MarkdownResult>
    rewritePumlMarkers(markdown: string, options: {
      markerPattern?: string | RegExp
      markerFlags?: string
      resolveLink(marker: {
        kind: string
        label: string
        target: string
        marker: string
      }): Promise<{ url: string; wrapImage: boolean } | undefined>
    }): Promise<Omit<MarkdownResult, 'changed'>>
  }

  interface PathsApi {
    decodeMarkdownTarget(target: string): string
    encodeMarkdownPath(filesystemPath: string): string
    imagePathForSource(options: {
      pumlDirectory: string
      distDirectory: string
      sourcePath: string
      format: ImageFormat
    }): string
    isPathInside(basePath: string, candidatePath: string, pathApi?: unknown): boolean
    localImageLink(options: { markdownPath: string; imagePath: string }): string
    resolveConfiguredDirectory(rootDirectory: string, value: string, description: string): string
    resolveWithin(basePath: string, value: string, description: string, pathApi?: unknown): string
    sourceRelativePath(pumlDirectory: string, sourcePath: string): string
  }

  interface PlantUmlApi {
    createLinkResolver(options: {
      pumlServerUrl: string
      linkMode: LinkMode
      shortener?: (url: string) => Promise<string>
    }): (input: { encodedData: string; imgFormat?: ImageFormat }) => Promise<string>
    defaultFetchBuffer(url: string): Promise<Uint8Array>
    encodePuml(data: string): string
    getFullPumlUrl(options: {
      imgFormat: ImageFormat
      encodedData: string
      pumlServerUrl: string
    }): string
    processPumlContent(options: {
      sourcePath: string
      pumlDirectory: string
      allPumlPaths: Set<string>
      pumlServerUrl: string
      linkMode: LinkMode
      shortener?: (url: string) => Promise<string>
      cache?: Map<string, ProcessedPumlContent>
      stack?: string[]
    }): Promise<ProcessedPumlContent | undefined>
  }

  interface SelectionApi {
    classifyChangedFiles(buffer: Uint8Array): { pumlFiles: string[]; markdownFiles: string[] }
    createGitignoreMatcher(gitignorePath: string, enabled: boolean): (relativePath: string, isDirectory?: boolean) => boolean
    listFiles(directory: string, extension: string, options?: {
      rootDirectory?: string
      isIgnored?: (relativePath: string, isDirectory?: boolean) => boolean
    }): string[]
    validateFileSelection(options: {
      files?: PathSelection
      rootDirectory: string
      allowedDirectory: string
      extension: string
      label: string
    }): string[] | undefined
  }

  interface ConfigApi {
    loadConfig(options: { explicitPath?: string; searchDirectory: string }): LoadedConfig
    loadProjectConfig(options?: LoadProjectConfigOptions): ProjectConfig & { rootDirectory: string }
    validateConfig(config: ProjectConfig, configPath: string): ProjectConfig
  }

  interface DefaultsApi {
    CONFIG_KEYS: ReadonlySet<string>
    DEFAULT_CONFIG: Readonly<ProjectConfig>
    DEFAULT_CONFIG_FILENAME: string
    DEFAULT_MARKER_PATTERN: string
  }

  const run: typeof pumlForMarkdown
  const loadProjectConfig: ConfigApi['loadProjectConfig']
  const includes: IncludesApi
  const markdown: MarkdownApi
  const paths: PathsApi
  const plantuml: PlantUmlApi
  const selection: SelectionApi
  const config: ConfigApi
  const defaults: DefaultsApi
}

export = pumlForMarkdown
