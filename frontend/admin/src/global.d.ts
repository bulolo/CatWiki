import zh from "./messages/zh.json"

type Messages = typeof zh;

declare global {
  interface IntlMessages extends Messages {}
}
