/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { proxyLazy } from "@utils/lazy";
import { findByCode, findByProps, findByPropsLazy } from "@webpack";
import { Parser } from "@webpack/common";
import { JSX } from "react";

import CreateVoiceFilterModal from "./CreateVoiceFilterModal";
import HelpModal from "./HelpModal";
import { cl } from "./utils";
import VoiceFiltersModal from "./VoiceFiltersModal";

interface MarkdownRules {
  allowDevLinks: boolean;
  allowEmojiLinks: boolean;
  allowHeading: boolean;
  allowLinks: boolean;
  allowList: boolean;
  channelId: string;
  disableAnimatedEmoji: boolean;
  disableAutoBlockNewlines: boolean;
  forceWhite: boolean;
  formatInline: boolean;
  isInteracting: boolean;
  mentionChannels: string[];
  messageId: string;
  muted: boolean;
  noStyleAndInteraction: boolean;
  previewLinkTarget: boolean;
  soundboardSounds: string[];
  unknownUserMentionPlaceholder: boolean;
  viewingChannelId: string;
}

const defaultRules: Partial<MarkdownRules> = { allowLinks: true, allowList: true, allowHeading: true };

const MarkdownContainerClasses = findByPropsLazy("markup", "codeContainer");
const modalLinkRegex = /^<vf:(help|createVoice|main)>/;
const imageRegex = /^!\[((?:\[[^\]]*\]|[^[\]]|\](?=[^[]*\]))*)\]\(\s*((?:\([^)]*\)|[^\s\\]|\\.)*?)\)/;

const actions: Record<string, { action: () => void, name: string; }> = {
  help: {
    action: () => HelpModal.open(),
    name: "Help menu"
  },
  createVoice: {
    action: () => CreateVoiceFilterModal.open(),
    name: "Voice pack creator menu"
  },
  main: {
    action: () => VoiceFiltersModal.open(),
    name: "Main menu"
  },
};

const parser: typeof Parser.parse = proxyLazy(() => {
  const DiscordRules = findByProps("AUTO_MODERATION_SYSTEM_MESSAGE_RULES").RULES;
  const AdvancedRules = findByCode("channelMention:")({});

  const customRules = {
    modalLink: {
      order: DiscordRules.staticRouteLink.order,
      match: source => modalLinkRegex.exec(source),
      parse: ([, target]) => (actions[target]),
      react: ({ action, name }) => (
        <span className="channelMention interactive vc-voice-filters-modal-link" role="link" onClick={action}>{name}</span>
      ),
      requiredFirstCharacters: ["<"]
    },
    image: {
      ...Parser.defaultRules.link,
      match: source => imageRegex.exec(source),
      parse: ([, title, target]) => ({ title, target }),
      react: ({ title, target }) => <div className="vc-voice-filters-md-image">
        <img src={target} alt={title} />
      </div>,
      requiredFirstCharacters: ["!"]
    }
  };

  const builtinRules = new Set([...Object.keys(DiscordRules), ...Object.keys(AdvancedRules)]);

  for (const rule of builtinRules) {
    customRules[rule] = {
      ...DiscordRules[rule],
      ...AdvancedRules[rule],
    };
  }

  return (Parser as any).reactParserFor(customRules);
});

interface MarkdownProps extends Omit<JSX.IntrinsicElements["div"], "children"> {
  content: string;
  markdownRules?: Partial<MarkdownRules>;
}


export function Markdown({ content, markdownRules = defaultRules, className, ...props }: MarkdownProps) {
  return <div className={cl(MarkdownContainerClasses.markup, "vc-voice-filters-md", className)} {...props}>
    {parser(content, false, markdownRules)}
  </div>;
}
