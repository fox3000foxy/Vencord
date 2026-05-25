/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps } from "@webpack";

import { banlist } from "./banlist";

const settings = definePluginSettings({
    version: {
        type: OptionType.SELECT,
        description: "The version you want your message to render",
        options: [
            { label: "None", value: -1 },
            { label: "Roblox Version", value: 1 },
            { label: "Hard Version", value: 1 }
        ]
    }
});

const normalizeWord = w => w.replace(/0/g, 'o').replace(/1/g, 'i').replace(/l/g, 'i');
const normalizeMsg = s => s.replace(/0/g, 'o').replace(/1/g, 'i').replace(/l/g, 'i');

const robloxVersion = (content: string, patterns: RegExp[]) => {
    const norm = normalizeMsg(content);
    const censorPositions = new Set();

    for (const re of patterns) {
        re.lastIndex = 0;
        let match;
        while ((match = re.exec(norm)) !== null) {
            for (let i = match.index; i < match.index + match[0].length; i++) {
                censorPositions.add(i);
            }
            if (re.lastIndex === match.index) re.lastIndex++;
        }
    }

    let result = "";
    for (let i = 0; i < content.length; i++) {
        result += censorPositions.has(i) ? "#" : content[i];
    }
    return result;
};

const hardVersion = (content: string, patterns: RegExp[]) => {
    const n = normalizeMsg(content);
    for (const re of patterns) {
        if (re.test(n)) {
            return `🔒 Message has been Redacted.
-# Discord now requires ID verification in order to see certain messages. [Learn More](https://support.discord.com/hc/en-us/articles/18210995019671-Discord-Sensitive-Content-Filters)`;
        }
    }
    return content;
};

export default definePlugin({
    name: "AntiBadWords",
    description: "Use Roblox chat filter directly in Discord!",
    authors: [Devs.fox3000foxy],
    dependencies: ["UserSettingsAPI"],
    settings,
    start: () => {
        const clean = {};
        for (const w of banlist) {
            const n = normalizeWord(w);
            clean[n] = true;
        }
        const cleanWords = Object.keys(clean).sort((a, b) => b.length - a.length);
        const patterns = cleanWords.map(w => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '\\w*?'), 'gi'));

        findByProps("_dispatch").addInterceptor(e => {
            if (e.type === "MESSAGE_CREATE" || e.type === "MESSAGE_UPDATE") {
                switch (settings.store.version) {
                    case -1:
                        break;
                    case 1:
                        e.message.content = robloxVersion(e.message.content, patterns);
                        break;
                    case 2:
                        e.message.content = hardVersion(e.message.content, patterns);
                        break;
                }
            }
            if (e.type === 'LOAD_MESSAGES_SUCCESS') {
                e.messages.forEach(message => message.content ? message.content = robloxVersion(message.content, patterns) : null);
            }
        });
    },

    async onBeforeMessageSend(_, message) {
        if (!settings.store.version) return;
        if (!message.content) return;

        const clean = {};
        for (const w of banlist) {
            const n = normalizeWord(w);
            clean[n] = true;
        }
        const cleanWords = Object.keys(clean).sort((a, b) => b.length - a.length);
        const patterns = cleanWords.map(w => new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '\\w*?'), 'gi'));

        switch (settings.store.version) {
            case -1:
                break;
            case 1:
                message.content = robloxVersion(message.content, patterns);
                break;
            case 2:
                message.content = hardVersion(message.content, patterns);
                break;
        }
    }
});


