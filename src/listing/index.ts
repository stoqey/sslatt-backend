import AdsListingPublicResolver from "./AdsListing.public.resolver";
import AdsListingResolver from "./AdsListing.resolver";

export const getAdListingResolvers = () => [AdsListingPublicResolver, AdsListingResolver];