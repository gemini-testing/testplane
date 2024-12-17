import proxyquire from "proxyquire";
import sinon, { type SinonStub } from "sinon";
import type {
    searchSharedObjectPackage as SearchSharedObjectPackage,
    getBinarySharedObjectDependencies as GetBinarySharedObjectDependencies,
} from "../../../../../src/browser-installer/ubuntu-packages/collect-dependencies/shared-object";

describe("browser-installer/ubuntu-packages/collect-dependencies/shared-object", () => {
    const sandbox = sinon.createSandbox();

    let searchSharedObjectPackage: typeof SearchSharedObjectPackage;
    let getBinarySharedObjectDependencies: typeof GetBinarySharedObjectDependencies;

    let readElfStub: SinonStub;
    let aptFileSearchStub: SinonStub;

    beforeEach(() => {
        readElfStub = sandbox.stub().resolves();
        aptFileSearchStub = sandbox.stub().resolves();

        const sharedObject = proxyquire(
            "../../../../../src/browser-installer/ubuntu-packages/collect-dependencies/shared-object",
            {
                "./ubuntu": {
                    readElf: readElfStub,
                    aptFileSearch: aptFileSearchStub,
                },
            },
        );

        ({ searchSharedObjectPackage, getBinarySharedObjectDependencies } = sharedObject);
    });

    afterEach(() => sandbox.restore());

    describe("searchSharedObjectPackage", () => {
        it("should return package name closest to shared object name", async () => {
            aptFileSearchStub.withArgs("libnss3.so").resolves(`firefox\nlibnss3\n`);

            const packageName = await searchSharedObjectPackage("libnss3.so");

            assert.equal(packageName, "libnss3");
        });
    });

    describe("getBinarySharedObjectDependencies", () => {
        it("should return binary direct shared object deps", async () => {
            readElfStub.resolves(`
Dynamic section at offset 0xb00 contains 26 entries:
    Tag        Type                         Name/Value
    0x0000000000000001 (NEEDED)             Shared library: [libpthread.so.0]
    0x0000000000000001 (NEEDED)             Shared library: [libdl.so.2]
    0x0000000000000001 (NEEDED)             Shared library: [libc.so.6]
    0x0000000000000015 (DEBUG)              0x0
    0x0000000000000007 (RELA)               0x2005b0
    0x0000000000000008 (RELASZ)             48 (bytes)
    0x0000000000000009 (RELAENT)            24 (bytes)
    0x0000000000000017 (JMPREL)             0x2005e0
    0x0000000000000002 (PLTRELSZ)           192 (bytes)
    0x0000000000000003 (PLTGOT)             0x203cc0
    0x0000000000000014 (PLTREL)             RELA
    0x0000000000000006 (SYMTAB)             0x200308
    0x000000000000000b (SYMENT)             24 (bytes)
    0x0000000000000005 (STRTAB)             0x2004c0
    0x000000000000000a (STRSZ)              238 (bytes)
    0x000000006ffffef5 (GNU_HASH)           0x2004a0
    0x0000000000000019 (INIT_ARRAY)         0x202af8
    0x000000000000001b (INIT_ARRAYSZ)       8 (bytes)
    0x000000000000001a (FINI_ARRAY)         0x202af0
    0x000000000000001c (FINI_ARRAYSZ)       8 (bytes)
    0x000000000000000c (INIT)               0x201a34
    0x000000000000000d (FINI)               0x201a50
    0x000000006ffffff0 (VERSYM)             0x200428
    0x000000006ffffffe (VERNEED)            0x200440
    0x000000006fffffff (VERNEEDNUM)         2
    0x0000000000000000 (NULL)               0x0
            `);

            const deps = await getBinarySharedObjectDependencies("binary/path");

            assert.deepEqual(deps, ["libpthread.so.0", "libdl.so.2", "libc.so.6"]);
        });
    });
});
