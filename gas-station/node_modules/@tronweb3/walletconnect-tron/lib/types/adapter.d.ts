import type { PublicStateControllerState, EventsControllerState } from '@reown/appkit';
import type WalletConnectClient from '@walletconnect/sign-client';
import type { SignClientTypes } from '@walletconnect/types';
import { ChainID, ThemeVariables } from './utils.js';
export interface WalletConnectAdapterConfig {
    network: ChainID;
    options: SignClientTypes.Options;
    /**
     * Theme mode configuration flag. By default themeMode option will be set to user system settings.
     * @default `system`
     * @type `dark` | `light`
     * @see https://docs.reown.com/appkit/react/core/theming
     */
    themeMode?: `dark` | `light`;
    /**
     * Theme variable configuration object.
     * @default undefined
     * @see https://docs.reown.com/appkit/react/core/theming#themevariables
     */
    themeVariables?: ThemeVariables;
    /**
     * Control the display of "All Wallets" button.
     * @default `HIDE` (recommended for Tron as most wallets don't support it)
     * @see https://docs.reown.com/appkit/react/core/options
     */
    allWallets?: 'SHOW' | 'HIDE' | 'ONLY_MOBILE';
    /**
     * List of featured wallet IDs to display first (in order).
     * @see https://walletguide.walletconnect.network/ to find wallet IDs
     */
    featuredWalletIds?: string[];
    /**
     * Whitelist of wallet IDs to include (if set, only these wallets will be shown).
     */
    includeWalletIds?: string[];
    /**
     * Blacklist of wallet IDs to exclude.
     */
    excludeWalletIds?: string[];
    /**
     * Custom wallets to add to the list.
     */
    customWallets?: any[];
    /**
     * Enable Reown cloud analytics.
     * @default true
     */
    enableAnalytics?: boolean;
    /**
     * Enable debug logs.
     * @default false
     */
    debug?: boolean;
    /**
     * Additional AppKit configuration options.
     * Any extra properties will be passed directly to createAppKit.
     */
    [key: string]: any;
}
export declare enum WalletConnectMethods {
    signTransaction = "tron_signTransaction",
    signMessage = "tron_signMessage"
}
interface WalletConnectWalletInit {
    address: string;
}
export declare class WalletConnectWallet {
    private _client;
    private _session;
    private readonly _network;
    private readonly _options;
    private readonly _config;
    private appKit;
    private provider;
    private providerPromise;
    private address;
    private eventListeners;
    private sessionHandlers;
    private modalStateUnsubscribers;
    private eventUnsubscribers;
    private pendingModalCallbacks;
    private pendingEventCallbacks;
    constructor(config: WalletConnectAdapterConfig);
    private getProvider;
    private extractAddressFromSession;
    private extractAllAddressesFromSession;
    private emit;
    on(event: 'accountsChanged', listener: (accounts: string[]) => void): () => void;
    on(event: 'disconnect', listener: () => void): () => void;
    off(event: string, listener: Function): void;
    removeAllListeners(event?: string): void;
    private setupSessionListeners;
    private setupModalListeners;
    connect(): Promise<WalletConnectWalletInit>;
    disconnect(): Promise<void>;
    get client(): WalletConnectClient;
    checkConnectStatus(): Promise<WalletConnectWalletInit>;
    signTransaction(transaction: any): Promise<any>;
    signMessage(message: string): Promise<any>;
    /**
     * Close the AppKit modal.
     * @throws {Error} If AppKit is not initialized
     */
    closeModal(): Promise<void>;
    /**
     * Set the theme mode (light or dark).
     * @param mode - 'light' or 'dark'
     * @throws {Error} If AppKit is not initialized
     */
    setThemeMode(mode: 'light' | 'dark'): void;
    /**
     * Subscribe to AppKit modal state changes.
     * @param callback - Callback function called when state changes
     * @returns Unsubscribe function
     * @note Can be called before connect(). Subscription will be active after AppKit is initialized.
     */
    subscribeModalState(callback: (state: PublicStateControllerState) => void): () => void;
    /**
     * Subscribe to all AppKit events.
     * @param callback - Callback function called on each event
     * @returns Unsubscribe function
     * @note Can be called before connect(). Subscription will be active after AppKit is initialized.
     */
    subscribeEvents(callback: (event: EventsControllerState) => void): () => void;
}
export {};
//# sourceMappingURL=adapter.d.ts.map