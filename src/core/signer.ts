// Copyright © Aptos Foundation
// SPDX-License-Identifier: Apache-2.0

import { sign } from "../transactions";
import { AccountAuthenticator } from "../transactions/authenticator/account";
import { RawTransaction } from "../transactions/instances";
import { Account } from "./account";
import { AccountAddress } from "./accountAddress";

export type SignTransactionFunctionArgs = {
  sender: AccountAddress;
  rawTransaction: RawTransaction;
  feePayerAddress?: AccountAddress;
  secondarySignerAddresses?: Array<AccountAddress>;
};

// Where this is the function signature for a wallet adapter function..?
export type SignTransactionFunction = (args: SignTransactionFunctionArgs) => Promise<Signer>;

/**
 * Since the AccountAuthenticator doesn't indicate what an account's current address is, we can store it in a
 * `Signer` class that couples an AccountAuthenticator with the AccountAddress that it's signing for.
 * This is useful for a few things:
 *   1. Most importantly, directing the flow of transaction building, either in a local *or* a dapp context
 *   2. Encapsulating the behavior of a `&signer` primitive in the actual Move VM
 *   3. Coupling data for the transaction builder patterns, because you need both of these to create a signed transaction
 *
 * @example
 * const account = Account.generate();
 * const rawTransaction = generateRawTransaction({...});
 * const sender = Signer.fromLocalAccount({account, rawTransaction}); // from a local context
 *
 * @example const sender = Signer.fromAccountAuthenticator({address, authenticator}); // from a dapp context
 * @see AccountAddress
 * @see AccountAuthenticator
 * @see SignedTransaction
 */
export class Signer {
  public readonly accountAddress: AccountAddress;
  public readonly authenticator: AccountAuthenticator;

  private constructor(args: { address: AccountAddress; authenticator: AccountAuthenticator }) {
    this.accountAddress = args.address;
    this.authenticator = args.authenticator;
  }

  /**
   * If you possess the private keys for an account, you're probably operating in a local context.
   * You can create a `Signer` instance using this method by instantiating the account, generating
   * the transaction payload, and then passing it here.
   * @see Account
   * @see sign
   * @param args.account The Account instance containing the private keys that will sign the transaction
   * @param args.rawTransaction The transaction payload
   * @param args.secondarySignerAddresses optional. For a multi-agent or fee payer (aka sponsored) transactions
   * @param args.feePayerAddress optional. For a fee payer (aka sponsored) transaction
   */
  static fromAccount(args: {
    account: Account;
    rawTransaction: RawTransaction;
    secondarySignerAddresses?: Array<AccountAddress>;
    feePayerAddress?: AccountAddress;
  }): Signer {
    const { account, rawTransaction, secondarySignerAddresses, feePayerAddress } = args;
    // sign transaction as Account, inferring the signature type from the transaction payload and other args
    const anyRawTransaction = {
      rawTransaction: rawTransaction,
      feePayerAddress: feePayerAddress,
      secondarySignerAddresses: secondarySignerAddresses,
    };
    const authenticator = sign({ signer: account, transaction: anyRawTransaction });
    return new Signer({ address: account.accountAddress, authenticator });
  }

  /**
   * If you're operating in a dapp context, you can create a `Signer` instance using this method by
   * first obtaining an `AccountAuthenticator` instance, and then passing it here.
   *
   * An `AccountAuthenticator` can be obtained from a wallet provider signing a transaction.
   *
   * @param args.address The address of the account that will sign the transaction
   * @param args.authenticator The AccountAuthenticator instance that will sign the transaction
   */
  static async fromWalletProvider(args: {
    signTransactionFunctionArgs: SignTransactionFunctionArgs;
    signTransaction: SignTransactionFunction;
  }): Promise<Signer> {
    const { signTransactionFunctionArgs, signTransaction } = args;
    const signer = await signTransaction({ ...signTransactionFunctionArgs });
    return signer;
  }
}
