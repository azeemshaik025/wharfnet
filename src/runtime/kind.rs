//! The set of chain kinds wharfnet can boot.
//!
//! [`ChainKind`] is the typed spelling of the `kind` field that appears in
//! `wharfnet.toml` ([`ChainConfig`](crate::runtime::config::ChainConfig)) and in
//! the endpoints manifest ([`ChainEntry`](crate::runtime::manifest::ChainEntry)).
//! Serde (de)serializes it as its lowercase name — `ChainKind::Evm` ⇔ `"evm"` —
//! so the on-disk TOML and JSON are byte-for-byte what they were when `kind` was
//! a bare `String`.
//!
//! The point of the enum is exhaustiveness: the engine, faucet, config, and ABI
//! dispatch all `match` on it, so adding a variant here is a compile error at
//! every site that handles a kind — instead of a new magic string silently
//! falling through a `_` arm.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

/// A chain kind wharfnet knows how to boot and drive.
#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum ChainKind {
    /// Anvil (Foundry) — a generic EVM chain.
    Evm,
    /// starknet-devnet.
    Starknet,
    /// surfpool (Solana surfnet).
    Solana,
    /// bitcoind in regtest.
    Bitcoin,
    /// litecoind in regtest.
    Litecoin,
    /// anvil-zksync (ZKsync Era).
    Zksync,
}

impl ChainKind {
    /// Every kind, in a stable order — for exhaustive iteration in tests and
    /// help text.
    pub const ALL: [ChainKind; 6] = [
        ChainKind::Evm,
        ChainKind::Starknet,
        ChainKind::Solana,
        ChainKind::Bitcoin,
        ChainKind::Litecoin,
        ChainKind::Zksync,
    ];

    /// The lowercase wire name (`"evm"`, `"starknet"`, …). Identical to the serde
    /// representation and to what a user writes for `kind` in `wharfnet.toml`.
    pub fn as_str(self) -> &'static str {
        match self {
            ChainKind::Evm => "evm",
            ChainKind::Starknet => "starknet",
            ChainKind::Solana => "solana",
            ChainKind::Bitcoin => "bitcoin",
            ChainKind::Litecoin => "litecoin",
            ChainKind::Zksync => "zksync",
        }
    }
}

impl fmt::Display for ChainKind {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(self.as_str())
    }
}

impl FromStr for ChainKind {
    type Err = String;

    /// Parse a kind from its wire name, listing the supported set on a miss.
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        ChainKind::ALL
            .into_iter()
            .find(|k| k.as_str() == s)
            .ok_or_else(|| {
                let supported = ChainKind::ALL
                    .iter()
                    .map(|k| k.as_str())
                    .collect::<Vec<_>>()
                    .join(", ");
                format!("unknown chain kind '{s}' (supported: {supported})")
            })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn as_str_and_display_agree_and_are_lowercase() {
        for kind in ChainKind::ALL {
            assert_eq!(kind.to_string(), kind.as_str());
            assert_eq!(kind.as_str(), kind.as_str().to_lowercase());
        }
    }

    #[test]
    fn serde_roundtrips_through_the_lowercase_wire_name() {
        // The wire form is the bare lowercase string (a JSON string, not a tagged
        // object) — the same bytes the manifest carried when `kind` was a String.
        for kind in ChainKind::ALL {
            let json = serde_json::to_string(&kind).unwrap();
            assert_eq!(json, format!("\"{}\"", kind.as_str()));
            let back: ChainKind = serde_json::from_str(&json).unwrap();
            assert_eq!(back, kind);
        }
    }

    #[test]
    fn deserializes_the_documented_wire_values() {
        assert_eq!(
            serde_json::from_str::<ChainKind>("\"zksync\"").unwrap(),
            ChainKind::Zksync
        );
        assert_eq!(
            serde_json::from_str::<ChainKind>("\"litecoin\"").unwrap(),
            ChainKind::Litecoin
        );
        // An unknown kind is rejected, listing the valid variants.
        let err = serde_json::from_str::<ChainKind>("\"aptos\"").unwrap_err();
        assert!(err.to_string().contains("unknown variant"), "{err}");
    }

    #[test]
    fn from_str_parses_every_variant_and_reports_unknowns() {
        for kind in ChainKind::ALL {
            assert_eq!(kind.as_str().parse::<ChainKind>().unwrap(), kind);
        }
        let err = "aptos".parse::<ChainKind>().unwrap_err();
        assert!(err.contains("aptos"), "{err}");
        assert!(err.contains("evm"), "{err}"); // lists the supported set
    }

    #[test]
    fn all_is_free_of_duplicates() {
        for (i, a) in ChainKind::ALL.iter().enumerate() {
            for b in &ChainKind::ALL[i + 1..] {
                assert_ne!(a, b);
            }
        }
    }
}
