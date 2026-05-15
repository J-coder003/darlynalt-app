import React from "react";
export type TabParamList = {
  Home: undefined;
  Jobs: undefined;
  Invoices: undefined;
  Chat: { chatId: string; userId: string }; 
  Wallet: undefined;
  Requests: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  MoneyRequest: undefined;
  RequestDetails: { requestId: string };
  RequestList: undefined;
  RequestManagement: undefined;
};
