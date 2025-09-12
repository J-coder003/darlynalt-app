export type TabParamList = {
  Home: undefined;
  Jobs: undefined;
  Invoices: undefined;
  Chat: { chatId: string; userId: string }; // ✅ Chat expects params
  Profile: undefined;
};
