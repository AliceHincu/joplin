import { createWriteStream } from 'fs';
import path = require('path');
import { parseArgs } from 'util';
// const https = require('https');
// const fs = require('fs');
const { promisify } = require('util');
const pipeline = promisify(require('stream').pipeline);
// const distDirName = 'dist';
// const distPath = path.join(__dirname, distDirName);
// const crypto = require('crypto');


interface Context {
	repo: string; // {owner}/{repo}
	githubToken: string;
	targetTag: string;
}

const apiBaseUrl = 'https://api.github.com/repos/';
const defaultApiHeaders = (context: Context) => ({
	'Authorization': `token ${context.githubToken}`,
	'X-GitHub-Api-Version': '2022-11-28',
	'Accept': 'application/vnd.github+json',
});

const getTargetRelease = async (context: Context, targetTag: string) => {
	console.log('Fetching releases...');

	// Note: We need to fetch all releases, not just /releases/tag/tag-name-here.
	// The latter doesn't include draft releases.

	const result = await fetch(`${apiBaseUrl}${context.repo}/releases`, {
		method: 'GET',
		headers: defaultApiHeaders(context),
	});

	const releases = await result.json();
	if (!result.ok) {
		throw new Error(`Error fetching release: ${JSON.stringify(releases)}`);
	}

	for (const release of releases) {
		if (release.tag_name === targetTag) {
			return release;
		}
	}

	throw new Error(`No release with tag ${targetTag} found!`);
};

// const updateReleaseAsset = async (context: Context, assetUrl: string, newName: string) => {
// 	console.log('Updating asset with URL', assetUrl, 'to have name, ', newName);

// 	// See https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28#update-a-release-asset
// 	const result = await fetch(assetUrl, {
// 		method: 'PATCH',
// 		headers: defaultApiHeaders(context),
// 		body: JSON.stringify({
// 			name: newName,
// 		}),
// 	});

// 	if (!result.ok) {
// 		throw new Error(`Unable to update release asset: ${await result.text()}`);
// 	}
// };

// Renames release assets in Joplin Desktop releases
// const renameReleaseAssets = async (context: Context, release: any) => {
// 	// Patterns used to rename releases
// 	const renamePatterns = [
// 		[/-arm64\.dmg$/, '-arm64.DMG'],
// 	];

// 	for (const asset of release.assets) {
// 		for (const [pattern, replacement] of renamePatterns) {
// 			if (asset.name.match(pattern)) {
// 				const newName = asset.name.replace(pattern, replacement);
// 				await updateReleaseAsset(context, asset.url, newName);

// 				// Only rename a release once.
// 				break;
// 			}
// 		}
// 	}
// };

// Download a file from Joplin Desktop releases
/* eslint-disable @typescript-eslint/no-explicit-any */
const downloadFile = async (asset: any): Promise<string> => {
	const downloadPath = path.join(__dirname, 'downloads', asset.name);
	/* eslint-disable no-console */
	console.log(`Downloading ${asset.name} to ${downloadPath}`);
	const response = await fetch(asset.browser_download_url);
	if (!response.ok) {
		throw new Error(`Failed to download file: Status Code ${response.status}`);
	}
	const fileStream = createWriteStream(downloadPath);
	await pipeline(response.body, fileStream);
	console.log('Download successful!');
	/* eslint-enable no-console */
	return downloadPath;
};

// const generateLatestArm64Yml = (dmgPath: string, zipPath: string) => {
// 	const calculateHash = (filePath: string) => {
// 		const fileBuffer = fs.readFileSync(filePath);
// 		const hashSum = crypto.createHash('sha512');
// 		hashSum.update(fileBuffer);
// 		return hashSum.digest('base64');
// 	};

// 	const getFileSize = (filePath: string) => {
// 		return fs.statSync(filePath).size;
// 	};

// 	const extractVersion = (filePath: string) => {
// 		return path.basename(filePath).split('-')[1];
// 	};

// 	const versionFromFilePath = extractVersion(zipPath);

// 	const info = {
// 		version: versionFromFilePath,
// 		dmgPath: dmgPath,
// 		zipPath: zipPath,
// 		releaseDate: new Date().toISOString(),
// 	};

// 	/* eslint-disable no-console */
// 	if (!fs.existsSync(info.dmgPath) || !fs.existsSync(info.zipPath)) {
// 		console.error('One or both executable files do not exist:', info.dmgPath, info.zipPath);
// 		return;
// 	}

// 	console.info('Calculating hash of files...');
// 	const dmgHash = calculateHash(info.dmgPath);
// 	const zipHash = calculateHash(info.zipPath);

// 	console.info('Calculating size of files...');
// 	const dmgSize = getFileSize(info.dmgPath);
// 	const zipSize = getFileSize(info.zipPath);

// 	console.info('Generating content of latest-mac-arm64.yml file...');
// 	const yamlFilePath = path.join(distPath, 'latest-mac-arm64.yml');
// 	const yamlContent = `version: ${info.version}
// files:
//   - url: ${path.basename(info.zipPath)}
//     sha512: ${zipHash}
//     size: ${zipSize}
//   - url: ${path.basename(info.dmgPath)}
//     sha512: ${dmgHash}
//     size: ${dmgSize}
// path: ${path.basename(info.zipPath)}
// sha512: ${zipHash}
// releaseDate: '${info.releaseDate}'
// `;
// 	fs.writeFileSync(yamlFilePath, yamlContent);
// 	console.log('YML file generated successfully for arm64 architecture.');

// 	const fileContent = fs.readFileSync(yamlFilePath, 'utf8');
// 	console.log('Generated YML Content:\n', fileContent);
// 	/* eslint-enable no-console */
// 	return yamlFilePath;
// };

/* eslint-disable @typescript-eslint/no-explicit-any */
const createReleaseAssets = async (context: Context, release: any) => {
	let dmgPath;
	let zipPath;
	for (const asset of release.assets) {
		if (asset.name.endsWith('-arm64.zip')) {
			zipPath = await downloadFile(asset);
		} else if (asset.name.endsWith('-arm64.DMG')) {
			dmgPath = await downloadFile(asset);
		}
	}

	console.log(dmgPath, zipPath);
	console.log(context);
};

// const uploadReleaseAsset = async (context: Context, release: any, filePath: string): Promise<void> => {
//     const fileContent = fs.readFileSync(filePath);
//     const fileName = path.basename(filePath);
//     const uploadUrl = `https://uploads.github.com/repos/${context.repo}/releases/${release.id}/assets?name=${encodeURIComponent(fileName)}`;

//     const response = await fetch(uploadUrl, {
//         method: 'POST',
//         headers: {
//             ...defaultApiHeaders(context),
//             'Content-Type': 'application/octet-stream',
//         },
//         body: fileContent
//     });

//     if (!response.ok) {
//         throw new Error(`Failed to upload asset: ${await response.text()}`);
//     }
//     console.log(`${fileName} uploaded successfully.`);
// }

const modifyReleaseAssets = async () => {
	const args = parseArgs({
		options: {
			tag: { type: 'string' },
			token: { type: 'string' },
			repo: { type: 'string' },
		},
	});

	if (!args.values.tag || !args.values.token || !args.values.repo) {
		throw new Error([
			'Required arguments: --tag, --token, --repo',
			'  --tag should be a git tag with an associated release (e.g. v12.12.12)',
			'  --token should be a GitHub API token',
			'  --repo should be a string in the form user/reponame (e.g. laurent22/joplin)',
		].join('\n'));
	}

	const context: Context = {
		repo: args.values.repo,
		githubToken: args.values.token,
		targetTag: args.values.tag,
	};

	const release = await getTargetRelease(context, context.targetTag);

	if (!release.assets) {
		console.log(release);
		throw new Error(`Release ${release.name} missing assets!`);
	}

	// console.log('Renaming release assets for tag', context.targetTag, context.repo);
	// void renameReleaseAssets(context, release);
	console.log('Creating latest-mac-arm64.yml asset for tag', context.targetTag, context.repo);
	void createReleaseAssets(context, release);
};

void modifyReleaseAssets();
