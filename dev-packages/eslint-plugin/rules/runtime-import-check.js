// @ts-check
/********************************************************************************
 * Copyright (C) 2021 Ericsson and others.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0 WITH Classpath-exception-2.0
 ********************************************************************************/

const path = require('path');

/**
 * Runtime-specific folders according to our coding guidelines.
 */
const folders = {
    common: '/common/',
    browser: '/browser/',
    node: '/node/',
    electronCommon: '/electron-common/',
    electronBrowser: '/electron-browser/',
    electronNode: '/electron-node/',
    electronMain: '/electron-main/',
};

/**
 * Mapping of folders to the list of folders it should not import from.
 * @type {[string, string[]][]}
 */
const restrictedMapping = [
    // We start by declaring the allowed imports, we'll negate those later.
    [folders.common, []],
    [folders.browser, [folders.common]],
    [folders.node, [folders.common]],
    [folders.electronCommon, [folders.common]],
    [folders.electronBrowser, [folders.electronCommon, folders.browser, folders.common]],
    [folders.electronNode, [folders.electronCommon, folders.node, folders.common]],
    [folders.electronMain, [folders.electronCommon, folders.node, folders.common]]
    // Next we convert the mapping from "allowed" to a list of "restricted" folders.
].map(([folder, allowed]) => /** @type {[string, string[]]} */(
    // We want to restrict everything that's either not `folder` nor in the list of allowed folders.
    [folder, Object.values(folders).filter(f => f !== folder && !allowed.includes(f))]
));

/** @type {import('eslint').Rule.RuleModule} */
module.exports = {
    meta: {
        type: 'problem',
        fixable: 'code',
        docs: {
            description: 'prevent imports from folders meant for incompatible runtimes.',
            url: 'https://github.com/eclipse-theia/theia/wiki/Code-Organization'
        },
    },
    create(context) {
        let relativeFilePath = path.relative(context.getCwd(), context.getFilename());
        // Normalize the path so we only deal with forward slashes.
        if (process.platform === 'win32') {
            relativeFilePath = relativeFilePath.replace(/\\/g, '/');
        }
        // Search for a folder following our naming conventions, keep the left-most match.
        // e.g. `src/electron-node/browser/node/...` should match `electron-node`
        let lowestIndex = Infinity;
        /** @type {string[] | undefined} */
        let restrictedFolders;
        /** @type {string | undefined} */
        let matchedFolder;
        for (const [folder, restricted] of restrictedMapping) {
            const index = relativeFilePath.indexOf(folder);
            if (index !== -1 && index < lowestIndex) {
                restrictedFolders = restricted;
                matchedFolder = folder;
                lowestIndex = index;
            }
        }
        // File doesn't follow our naming convention so we'll bail now.
        if (matchedFolder === undefined) {
            return {};
        }
        return {
            ImportDeclaration(node) {
                checkModuleImport(node.source);
            },
            TSExternalModuleReference(node) {
                checkModuleImport(node.expression);
            },
        }
        function checkModuleImport(node) {
            const module = /** @type {string} */(node.value);
            if (restrictedFolders.some(restricted => module.includes(restricted))) {
                context.report({
                    node,
                    message: `${module} cannot be imported in '${matchedFolder}'`
                });
            }
        }
    },
}
