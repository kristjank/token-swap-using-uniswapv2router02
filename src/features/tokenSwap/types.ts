export enum StoreTransactionType {
  APPROVAL,
  SWAP,
}

export type StoreTransaction = {
    hash: string
    type: StoreTransactionType
    associatedToken?: string
}
