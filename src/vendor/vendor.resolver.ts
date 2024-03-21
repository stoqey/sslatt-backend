import {
  Query,
  Resolver,
  UseMiddleware,
  Mutation,
} from "type-graphql";
import { VendorModel, VendorType } from "./vendor.model";
import { isAuth } from "@roadmanjs/auth"
import _get from "lodash/get";
import { Arg, ContextType, Ctx, ResType } from "couchset";
import { isEmpty, pick } from "lodash";
import { awaitTo } from "couchset/dist/utils";
import { getAllWalletsUsdCur } from "../wallet/wallet.utils";
import { getVendorStore } from "./vendor.methods";
import { OrderModel, OrderStatus } from "../order";
import { getVerifiedKey } from "../auth/Pgp.methods";
import { updateWallet } from "@roadmanjs/wallet";
import { getSiteSettings, upsertSiteStats } from "../settings/settings.methods";

@Resolver()
export class VendorResolver {
  @Query(() => VendorType, { nullable: true })
  @UseMiddleware(isAuth)
  async getVendor(
    @Ctx() ctx: ContextType,
  ): Promise<VendorType | null> {
    try {
      const userId = _get(ctx, 'payload.userId', '');
      const store = getVendorStore(userId);
      return store;
    }
    catch (error) {
      console.error(error)
      return null;
    }
  }

  @Query(() => Number, { nullable: true })
  @UseMiddleware(isAuth)
  async getMoneyInEscrow(
    @Ctx() ctx: ContextType,
  ): Promise<number | null> {
    try {

      const userId = _get(ctx, 'payload.userId', '');

      const store = getVendorStore(userId);
      if (!store) {
        throw new Error('Store not found');
      }

      const allOrders = await OrderModel.pagination({
        where: {
          seller: userId,
          status: OrderStatus.accepted
        }
      });

      const totalAmount = allOrders.reduce((acc, order) => acc + order.price * order.quantity, 0);
      return totalAmount;
    }
    catch (error) {
      console.error(error)
      return null;
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async createVendor(
    @Ctx() ctx: ContextType,
  ): Promise<ResType> {
    try {

      const userId = _get(ctx, 'payload.userId', '');

      // check user balance
      // check if exists
      // some stats updates

      if (isEmpty(userId)) throw new Error('User not found');

      const [errorExisting, existingStores] = await awaitTo(VendorModel.pagination({
        where: {
          owner: _get(ctx, 'payload.userId', '')
        }
      }))

      if (errorExisting) throw errorExisting;

      if (!isEmpty(existingStores)) throw new Error('Store already exists');

      const pgpKey = await getVerifiedKey(userId);
      if (!pgpKey) {
        throw new Error('Please add a pgp key first, all store owners must have 2FA enabled');
      }

      const siteSettings = await getSiteSettings();
      if (!siteSettings) {
        throw new Error('Internal error, please contact support');
      }
      const VENDOR_BOND = siteSettings.vendorBond;

      const { balanceUsd: walletsUsd, balanceCur } = await getAllWalletsUsdCur(userId, ["BTC"]);
      const totalAmountUsd = walletsUsd?.length ? walletsUsd.reduce((acc: number, wallet: any) => acc + wallet.balanceUsd, 0) : 0;

      if (totalAmountUsd < VENDOR_BOND) {
        throw new Error(`Vendor bond to create a store is ${VENDOR_BOND} USD`);
      };

      const usdRates = balanceCur[0].walletRate;
      const walletAmountToRemove = usdRates * VENDOR_BOND;

      const store = await VendorModel.create({
        owner: userId
      });

      await updateWallet({
        owner: userId,
        amount: -walletAmountToRemove,
        source: "vendor-bond",
        sourceId: store.id,
        currency: "BTC",
      });

      // todo queue
      await upsertSiteStats({ vendor: true });

      return { success: true, message: 'Store created', data: store };

    }
    catch (error) {
      console.error(error)
      return { success: false, message: error.message };
    }
  }

  @Mutation(() => ResType)
  @UseMiddleware(isAuth)
  async updateVendor(
    @Ctx() ctx: ContextType,
    @Arg('vendor', () => VendorType, { nullable: true }) vendor?: VendorType,
  ): Promise<ResType> {
    try {

      const userId = _get(ctx, 'payload.userId', '');

      if (isEmpty(userId)) throw new Error('User not found');

      if (!vendor?.id || isEmpty(vendor?.id)) throw new Error('Vendor must be defined');

      const existingVendor = await VendorModel.findById(vendor.id);

      if (!existingVendor) throw new Error('Vendor not found');

      if (existingVendor.owner !== userId) throw new Error('Vendor not found');

      const [errorUpdate, updatedStore] = await awaitTo(VendorModel.updateById(existingVendor?.id, {
        ...existingVendor,
        ...pick(vendor, ["name", "cover", "avatar", "country", "bio", "vacation", "shipsTo", "shipsFrom"])
      }))

      if (errorUpdate) throw errorUpdate;

      if (isEmpty(updatedStore)) throw new Error('Store not updated');

      return { success: true, message: 'Store updated', data: updatedStore };

    }
    catch (error) {
      console.error(error)
      return { success: false, message: error.message };
    }
  }




}

export default VendorResolver;
