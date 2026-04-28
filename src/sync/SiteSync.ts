import { useEnv } from '../utils/useEnv';
import { get as getSettings, post as postSettings } from '../api/site';
import fs from 'fs';
import path from 'path';

const SITE_DIR_NAME = 'Site';
const SITE_CONFIG_FILE_NAME = 'config.json';
const UNO_CONFIG_FILE_NAME = 'uno.config.ts';

const defaultUnoConfig = {
  content: {
    filesystem: [
      '*.html',
      '**/*.html'
    ]
  }
};

interface UnoConfigSource {
  unocssSettings?: unknown;
}

const SiteInfoUpdateKeys = [
  "id",
  "organizationId",
  "name",
  "folderName",
  "displayName",
  "cultures",
  "culture",
  "sitePath",
  "defaultCulture",
  "autoDetectCulture",
  "published",
  "status",
  "localRootPath",
  "enableCluster",
  "mirrorWebSiteBaseUrl",
  "enableVisitorLog",
  "enableImageLog",
  "enableSqlLog",
  "enableSitePath",
  "enableFullTextSearch",
  "enableMultilingual",
  "enableConstraintFixOnSave",
  "enableCORS",
  "enableFrontEvents",
  "enableBackendEvents",
  "enableConstraintChecker",
  "enableCache",
  "enableECommerce",
  "enablePublicModule",
  "enableSystemRoute",
  "enableFileIOUrl",
  "enableHtmlMinifier",
  "enableJsCssCompress",
  "enableJsCssBrowerCache",
  "enableImageBrowserCache",
  "enableImageAlt",
  "enableVideoBrowserCache",
  "enableSPA",
  "enableResourceCDN",
  "enableVisitorCountryRestriction",
  "visitorCountryRestrictions",
  "visitorCountryRestrictionPage",
  "imageCacheDays",
  "creationDate",
  "continueConvert",
  "previewUrl",
  "baseUrl",
  "lastUpdateTime",
  "ssoLogin",
  "customErrors",
  "customSettings",
  "forceSSL",
  "siteType",
  "whiteListPath",
  "specialPath",
  "includePath",
  "isApp",
  "automateCovertImageToWebp",
  "enableLighthouseOptimization",
  "enableCssSplitByMedia",
  "mobileMaxWidth",
  "desktopMinWidth",
  "defaultDatabase",
  "lighthouseSettingsJson",
  "pwa",
  "codeLogSettings",
  "sitemapSettings",
  "unocssSettings",
  "rateLimitSettings",
  "accessLimitSettings",
  "visibleAdvancedMenus",
  "enableTinymceToolbarSettings",
  "tinymceToolbarSettings",
  "tinymceSettings",
  "codeSuggestions",
  "recordSiteLogVideo",
  "enableUpdateSimilarPage",
  "enableResourceCache",
  "resourceCaches",
  "devPassword",
  "prUrl"
];

export async function pushSettingsTask() {
  const { KOOBOO_DIR } = useEnv();
  const siteInfoPath = path.join(KOOBOO_DIR, SITE_DIR_NAME, SITE_CONFIG_FILE_NAME);

  if (!fs.existsSync(siteInfoPath)) {
    throw new Error(`${SITE_DIR_NAME}/${SITE_CONFIG_FILE_NAME} 文件不存在, 无法同步Site信息`);
  }

  const siteInfo = JSON.parse(fs.readFileSync(siteInfoPath, 'utf-8'));
  writeUnoConfig(KOOBOO_DIR, siteInfo);
  const updateData: Record<string, unknown> = {};
  SiteInfoUpdateKeys.forEach(key => {
    if (siteInfo[key] !== undefined) {
      updateData[key] = siteInfo[key];
    }
  });
  await postSettings(updateData);
  console.log('Site信息已更新');
}

function parseUnoConfig(siteInfo: UnoConfigSource) {
  const unocssSettings = siteInfo.unocssSettings;
  if (!unocssSettings || typeof unocssSettings !== 'object' || Array.isArray(unocssSettings)) {
    return {};
  }

  const config = (unocssSettings as { config?: unknown }).config;
  if (typeof config !== 'string' || !config.trim()) {
    return {};
  }

  try {
    const parsedConfig = JSON.parse(config);
    return parsedConfig && typeof parsedConfig === 'object' && !Array.isArray(parsedConfig)
      ? parsedConfig
      : {};
  } catch (error) {
    console.warn(`解析 unocssSettings.config 失败: ${error instanceof Error ? error.message : String(error)}`);
    return {};
  }
}

function writeUnoConfig(koobooDir: string, siteInfo: UnoConfigSource) {
  const unoConfig = {
    ...defaultUnoConfig,
    ...parseUnoConfig(siteInfo)
  };
  const unoConfigPath = path.join(koobooDir, UNO_CONFIG_FILE_NAME);
  const content = `export default ${JSON.stringify(unoConfig, null, 2)};\n`;

  fs.writeFileSync(unoConfigPath, content);
  console.log('UnoCSS配置已保存到', unoConfigPath);
}

export async function pullSettingTask() {
  const { KOOBOO_DIR } = useEnv();
  const siteDir = path.join(KOOBOO_DIR, SITE_DIR_NAME);
  if (!fs.existsSync(siteDir)) {
    fs.mkdirSync(siteDir, { recursive: true });
  }

  const { site: siteInfo } = await getSettings();
  const siteInfoPath = path.join(siteDir, SITE_CONFIG_FILE_NAME);

  fs.writeFileSync(
    siteInfoPath,
    JSON.stringify(siteInfo, null, 2)
  );
  console.log('Site信息已保存到', siteInfoPath);
  writeUnoConfig(KOOBOO_DIR, siteInfo);
}
