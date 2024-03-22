import { SiteSettings } from "src/settings/settings.model";

export const WelcomeMessage = `
Welcome to Sslatt! \n
Hello and a warm welcome to Sslatt, the place where amazing deals meet incredible choices! 🛍️ \n
🌐 Dive into our vast selection of unique products and find just what you have been looking for. \n
🔒 Shop with confidence, knowing that our top priority is your safety and satisfaction. \n
🤝 Connect with sellers and buyers from all over the world. \n
Got questions? Our friendly support team is always here to help. Simply click on the 'Chat' button at the top right of your screen. \n
Happy shopping and here's to finding your next treasure on Sslatt! \n
\n
Warm Regards, \n
The Sslatt Team 💖 \n
\n
P.S. Don't forget to set up your profile and preferences to get the most personalized experience! 🎉
`;

export const adminUser = {
    id: "sslatt-admin",
    username: "sslatt",
    fullname: "Sslatt Support Team",
    firstname: "Sslatt",
    lastname: "Support Team",
    phone: "",
    avatar:
        "",
    coverImage:
        "",
    admin: true,
};

export const initSiteSettings: SiteSettings = {
    id: "sslatt-site-settings",
    vendorBond: 600,
    feePrices: {
        withdrawMin: {
            BTC: 0.000101
        },
        withdrawFeePerc: 3,
        checkoutFeePerc: 5,
    }
};