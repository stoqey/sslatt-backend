import {
  ChatConvo,
  ChatConvoType,
  createChatMessage,
  startConvo,
} from "@roadmanjs/chat";
import { SiteSettings, SiteSettingsModel } from "../settings/settings.model";
import { WelcomeMessage, adminUser, initSiteSettings } from "../_config/site";

import { UserModel } from "@roadmanjs/auth";
import { awaitTo } from "couchset/dist/utils";
import { log } from "roadman";

export * from "../_config/site";

export const createAdminUser = async () => {
  try {
    const [_, existingAdmin] = await awaitTo(UserModel.findById(adminUser.id));
    if (existingAdmin && existingAdmin.id) {
      log("admin user already exists");
      return
    };
    const createdAdminUser = await UserModel.create(adminUser);
    log("create admin user", createdAdminUser);
  } catch (error) {
    log("error creating admin users", error);
  }
};

export const createInitChatWithAdmin = async (userId: string) => {
  try {
    if (userId === adminUser.id) {
      return;
    }

    const initConvo: ChatConvoType = {
      owner: userId,
      members: [userId, adminUser.id],
      group: true,
    };

    const startedInitChat = await startConvo(initConvo);

    if (startedInitChat.success) {
      const createdChatConvo: ChatConvo = startedInitChat.data as ChatConvo;
      if (!createdChatConvo.lastMessage) {
        const mockCtx: any = {
          payload: {
            userId: adminUser.id,
          },
        };
        // create init message from admin
        const newMessage: any = {
          convoId: createdChatConvo.convoId,
          owner: adminUser.id,
          message: WelcomeMessage,
        };

        // TODO to replace with @roadmanjs/bull
        // handle couchbase racings
        return setTimeout(async () => {
          const createdInitWelcomeMessage = await createChatMessage(
            mockCtx,
            newMessage
          );
          log("created init message", createdInitWelcomeMessage);
        }, 2000);
      }
    }
    throw new Error("error creating init chat with admin");
  } catch (error) {
    console.error("error creating init chat with admin", error);
    return null;
  }
};

export const createSiteSettings = async () => {
  try {
    const [_, existingSiteSettings] = await awaitTo(SiteSettingsModel.findById(initSiteSettings.id));
    if (existingSiteSettings && existingSiteSettings.id) {
      log("site settings already exists");
      return
    };
    const createdSiteSettings = await SiteSettingsModel.create(initSiteSettings);
    log("created site settings", createdSiteSettings);
  } catch (error) {
    log("error creating site settings", error);
  }
};