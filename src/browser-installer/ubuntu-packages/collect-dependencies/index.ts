import _ from "lodash";
import { EXTRA_FIREFOX_SHARED_OBJECTS } from "./constants";
import { getBinarySharedObjectDependencies, searchSharedObjectPackage } from "./shared-object";
import { Cache } from "./cache";
import { fetchBrowsersMilestones } from "./browser-versions/index";
import { downloadBrowserVersions } from "./browser-downloader";
import { getUbuntuMilestone, writeUbuntuPackageDependencies } from "..";
import * as logger from "../../../utils/logger";
import { resolveTransitiveDependencies } from "../apt";

const createResolveSharedObjectToPackageName =
    (cache: Cache) =>
    async (sharedObject: string): Promise<string> => {
        if (cache.hasResolvedPackageName(sharedObject)) {
            return cache.getResolvedPackageName(sharedObject);
        }

        const packageName = await searchSharedObjectPackage(sharedObject);

        cache.savePackageName(sharedObject, packageName);

        return packageName;
    };

async function main(): Promise<void> {
    const ubuntuMilestone = await getUbuntuMilestone();

    logger.log(`Detected ubuntu release: "${ubuntuMilestone}"`);

    const cache = await new Cache(ubuntuMilestone).read();

    const browserVersions = await fetchBrowsersMilestones();

    logger.log(`Fetched ${browserVersions.length} browser milestones`);

    const browsersToDownload = cache.filterProcessedBrowsers(browserVersions);

    logger.log(`There are ${browsersToDownload.length} browsers to download`);

    const binaryPaths = await downloadBrowserVersions(browsersToDownload);

    logger.log(`There are ${binaryPaths.length} binaries in registry (browsers with drivers)`);

    const downloadedBinarySharedObjectsArrays = await Promise.all(binaryPaths.map(getBinarySharedObjectDependencies));
    const downloadedBinarySharedObjects = _.flatten(downloadedBinarySharedObjectsArrays);

    const extraBinarySharedObjects = cache.getUnresolvedSharedObjects().concat(EXTRA_FIREFOX_SHARED_OBJECTS);

    const uniqSharedObjects = _.uniq(downloadedBinarySharedObjects.concat(extraBinarySharedObjects));

    logger.log(`There are ${uniqSharedObjects.length} shared objects to resolve`);

    const resolveSharedObjectToPackageName = createResolveSharedObjectToPackageName(cache);
    const ubuntuPackages = await Promise.all(uniqSharedObjects.map(resolveSharedObjectToPackageName));
    const uniqUbuntuPackages = _.uniq(ubuntuPackages).filter(Boolean);

    logger.log(`Resolved ${uniqSharedObjects.length} shared objects to ${uniqUbuntuPackages.length} packages`);

    const withRecursiveDependencies = await resolveTransitiveDependencies(uniqUbuntuPackages);

    logger.log(`Resolved direct packages to ${withRecursiveDependencies.length} dependencies`);

    cache.saveProcessedBrowsers(browsersToDownload);

    await cache.write();

    logger.log("Saved cache to file system");

    await writeUbuntuPackageDependencies(ubuntuMilestone, withRecursiveDependencies);

    logger.log(`Saved ubuntu package direct dependencies for Ubuntu@${ubuntuMilestone}`);
}

main();
