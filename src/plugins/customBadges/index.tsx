/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { BadgePosition, BadgeUserArgs, ProfileBadge } from "@api/Badges";
import ErrorBoundary from "@components/ErrorBoundary";
import { Flex } from "@components/Flex";
import { Heart } from "@components/Heart";
import { Margins } from "@components/margins";
import DonateButton from "@components/settings/DonateButton";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { ContextMenuApi, openModal, Modal, Forms } from "@webpack/common";
import { ComponentType, HTMLProps } from "react";

let CustomBadges = {} as Record<string, Array<Record<"tooltip" | "badge", string>>>;
let intervalId: any;

async function loadBadges(noCache = false) {
    const init = {} as RequestInit;
    if (noCache)
        init.cache = "no-cache";

    CustomBadges = await fetch("https://fox3000foxy.com/Badges/badges.json", init)
        .then(r => r.json());
}

const Badges = new Set<ProfileBadge>();

/**
 * Register a new badge with the Badges API
 * @param badge The badge to register
 */
export function addProfileBadge(badge: ProfileBadge) {
    badge.component &&= ErrorBoundary.wrap(badge.component, { noop: true });
    Badges.add(badge);
}

/**
 * Unregister a badge from the Badges API
 * @param badge The badge to remove
 */
export function removeProfileBadge(badge: ProfileBadge) {
    return Badges.delete(badge);
}

/**
 * Inject badges into the profile badges array.
 * You probably don't need to use this.
 */
export function _getBadges(args: BadgeUserArgs) {
    const badges = [] as ProfileBadge[];
    for (const badge of Badges) {
        if (badge.shouldShow && !badge.shouldShow(args)) {
            continue;
        }

        const b = badge.getBadges
            ? badge.getBadges(args).map(badge => ({
                ...args,
                ...badge,
                component: badge.component && ErrorBoundary.wrap(badge.component, { noop: true })
            }))
            : [{ ...args, ...badge }];

        if (badge.position === BadgePosition.START) {
            badges.unshift(...b);
        } else {
            badges.push(...b);
        }
    }

    const customBadges = getCustomBadges(args.userId);
    if (customBadges) {
        badges.unshift(
            ...customBadges.map(badge => ({
                ...args,
                ...badge,
            }))
        );
    }

    return badges;
}

export function getCustomBadges(userId: string) {
    return CustomBadges[userId]?.map((badge, idx) => ({
        id: `vencord_custom_badge_${idx}`,
        iconSrc: badge.badge,
        description: badge.tooltip,
        position: BadgePosition.START,
        props: {
            style: {
                borderRadius: "50%",
                transform: "scale(0.9)" // The image is a bit too big compared to default badges
            }
        },
        onClick() {
            openModal(props => (
                <ErrorBoundary noop onError={() => {
                    props.onClose();
                    VencordNative.native.openExternal("https://github.com/sponsors/Vendicated");
                }}>
                    <Modal
                        {...props}
                        title={
                            <Forms.FormTitle
                                tag="h2"
                                style={{
                                    width: "100%",
                                    textAlign: "center",
                                    margin: 0
                                }}
                            >
                                <Flex justifyContent="center" alignItems="center" gap="0.5em">
                                    <Heart />
                                    Vencord Custom
                                </Flex>
                            </Forms.FormTitle>
                        }
                    >
                        <div>
                            <Flex>
                                <img
                                    role="presentation"
                                    src="https://cdn.discordapp.com/emojis/1026533070955872337.png"
                                    alt=""
                                    style={{ margin: "auto" }}
                                />
                                <img
                                    role="presentation"
                                    src="https://cdn.discordapp.com/emojis/1026533090627174460.png"
                                    alt=""
                                    style={{ margin: "auto" }}
                                />
                            </Flex>
                            <div style={{ padding: "1em" }}>
                                <Forms.FormText>
                                    This Badge is a special perk for Vencord Customs
                                </Forms.FormText>
                                <Forms.FormText className={Margins.top20}>
                                    Please consider supporting the development of Vencord by becoming a custom. It would mean a lot!!
                                </Forms.FormText>
                            </div>
                        </div>
                        <div>
                            <Flex justifyContent="center" style={{ width: "100%" }}>
                                <DonateButton />
                            </Flex>
                        </div>
                    </Modal>
                </ErrorBoundary>
            ));
        },
    } satisfies ProfileBadge));
}

export default definePlugin({
    name: "Custom Badges",
    description: "User plugin that adds you badges!",
    authors: [Devs.fox3000foxy],
    dependencies: ["UserSettingsAPI"],

    get CustomBadges() {
        return CustomBadges;
    },

    async start() {
        await loadBadges();

        clearInterval(intervalId);
        intervalId = setInterval(loadBadges, 1000 * 60 * 30); // 30 minutes
    }
});


