/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins } from "@api/PluginManager";
import { classes, Devs } from "@utils/index";
import definePlugin, { IconProps } from "@utils/types";
import type { PropsWithChildren } from "react";

import HypeSquadTab from "./tabs";

interface BaseIconProps extends IconProps {
    viewBox: string;
}

function Icon({ height = 24, width = 24, className, children, viewBox, ...svgProps }: PropsWithChildren<BaseIconProps>) {
    return (
        <svg
            className={classes(className, "vc-icon")}
            role="img"
            width={width}
            height={height}
            viewBox={viewBox}
            {...svgProps}
        >
            {children}
        </svg>
    );
}

export function HypeSquadIcon(props: IconProps) {
    return (
        <Icon
            {...props}
            viewBox="0 0 24 24"
        >
            <img src="https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png" alt="HypeSquad Icon" />
            {/* <path fill={"currentColor"} fillRule="evenodd" d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm6.81 7c-.54 0-1 .26-1.23.61A1 1 0 0 1 8.92 8.5 3.49 3.49 0 0 1 11.82 7c1.81 0 3.43 1.38 3.43 3.25 0 1.45-.98 2.61-2.27 3.06a1 1 0 0 1-1.96.37l-.19-1a1 1 0 0 1 .98-1.18c.87 0 1.44-.63 1.44-1.25S12.68 9 11.81 9ZM13 16a1 1 0 1 1-2 0 1 1 0 0 1 2 0Zm7-10.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM18.5 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM7 18.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0ZM5.5 7a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" clipRule="evenodd" /> */}
        </Icon>
    );
}


const settingsEntry = {
    key: "hypesquadback",
    title: "HypeSquad",
    panelTitle: "HypeSquad Settings",
    Component: HypeSquadTab,
    Icon: HypeSquadIcon
};

const legacySectionFactory = (SectionTypes: { HEADER: string; DIVIDER: string; CUSTOM: string; }) => ({
    section: "HypesquadBackSettings",
    label: "HypeSquad",
    element: HypeSquadTab,
    icon: HypeSquadIcon,
    className: "vc-settings"
});

export default definePlugin({
    name: "HypesquadBack",
    description: "Adds the option to switch back to your Hypesquad house if you leave it.",
    authors: [Devs.Fox3000foxy],
    dependencies: ["UserSettingsAPI", "Settings"],

    start() {
        const coreSettings: any = (plugins as any).Settings;
        if (!coreSettings) return;

        coreSettings.customEntries ??= [];
        coreSettings.customSections ??= [];

        // if (!coreSettings.customEntries.some((e: any) => e?.key === settingsEntry.key))
        //     coreSettings.customEntries.push(settingsEntry);

        if (!coreSettings.customSections.includes(legacySectionFactory))
            coreSettings.customSections.push(legacySectionFactory);
    },

    stop() {
        const coreSettings: any = (plugins as any).Settings;
        if (!coreSettings) return;

        if (Array.isArray(coreSettings.customEntries)) {
            const idx = coreSettings.customEntries.findIndex((e: any) => e?.key === settingsEntry.key);
            if (idx !== -1) coreSettings.customEntries.splice(idx, 1);
        }

        if (Array.isArray(coreSettings.customSections)) {
            const idx = coreSettings.customSections.indexOf(legacySectionFactory);
            if (idx !== -1) coreSettings.customSections.splice(idx, 1);
        }
    }

});
