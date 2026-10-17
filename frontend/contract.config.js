// 由 npm run deploy / npm run deploy-profile 自动生成（请勿手改）
window.TALENTSCOUT = {
  "chainId": 10143,
  "rpcUrl": "https://testnet-rpc.monad.xyz",
  "explorer": "https://testnet.monadscan.com",
  "contractAddress": "0xAB01cfA7Da5e44df314bA167C9f262f17CF6dda7",
  "abi": [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "company",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint32",
          "name": "total",
          "type": "uint32"
        }
      ],
      "name": "InterestMarked",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "text",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalTips",
          "type": "uint256"
        }
      ],
      "name": "MessagePosted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "indexed": false,
          "internalType": "string",
          "name": "tagline",
          "type": "string"
        }
      ],
      "name": "Published",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint32",
          "name": "votes",
          "type": "uint32"
        }
      ],
      "name": "Recommended",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "from",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "totalTips",
          "type": "uint256"
        }
      ],
      "name": "Tipped",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "voter",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint32",
          "name": "votes",
          "type": "uint32"
        }
      ],
      "name": "Voted",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        {
          "indexed": true,
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "indexed": true,
          "internalType": "address",
          "name": "owner",
          "type": "address"
        },
        {
          "indexed": false,
          "internalType": "uint256",
          "name": "amount",
          "type": "uint256"
        }
      ],
      "name": "Withdrawn",
      "type": "event"
    },
    {
      "inputs": [],
      "name": "MAX_LINKS",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_MESSAGE",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_NAME",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_SKILLS",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MAX_TAGLINE",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "MESSAGE_FEE",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "candidateCount",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "name": "getCandidate",
      "outputs": [
        {
          "components": [
            {
              "internalType": "address",
              "name": "owner",
              "type": "address"
            },
            {
              "internalType": "string",
              "name": "name",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "tagline",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "skills",
              "type": "string"
            },
            {
              "internalType": "string",
              "name": "links",
              "type": "string"
            },
            {
              "internalType": "uint8",
              "name": "theme",
              "type": "uint8"
            },
            {
              "internalType": "uint32",
              "name": "votes",
              "type": "uint32"
            },
            {
              "internalType": "uint256",
              "name": "tips",
              "type": "uint256"
            },
            {
              "internalType": "uint32",
              "name": "msgCount",
              "type": "uint32"
            },
            {
              "internalType": "uint32",
              "name": "interestCount",
              "type": "uint32"
            },
            {
              "internalType": "bool",
              "name": "recommended",
              "type": "bool"
            }
          ],
          "internalType": "struct TalentScout.Candidate",
          "name": "",
          "type": "tuple"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "name": "getMessages",
      "outputs": [
        {
          "internalType": "string[]",
          "name": "",
          "type": "string[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getStats",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "totalCandidates",
          "type": "uint256"
        },
        {
          "internalType": "uint256",
          "name": "threshold",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "n",
          "type": "uint256"
        }
      ],
      "name": "getTop",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "ids",
          "type": "uint256[]"
        },
        {
          "internalType": "uint32[]",
          "name": "votes",
          "type": "uint32[]"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "hasMarked",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        },
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "name": "hasVoted",
      "outputs": [
        {
          "internalType": "bool",
          "name": "",
          "type": "bool"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "name": "markInterest",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "organizer",
      "outputs": [
        {
          "internalType": "address",
          "name": "",
          "type": "address"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "name": "pending",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        },
        {
          "internalType": "string",
          "name": "text",
          "type": "string"
        }
      ],
      "name": "postMessage",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "string",
          "name": "name",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "tagline",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "skills",
          "type": "string"
        },
        {
          "internalType": "string",
          "name": "links",
          "type": "string"
        },
        {
          "internalType": "uint8",
          "name": "theme",
          "type": "uint8"
        }
      ],
      "name": "publish",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "t",
          "type": "uint256"
        }
      ],
      "name": "setVoteThreshold",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "k",
          "type": "uint256"
        }
      ],
      "name": "snapshotTopK",
      "outputs": [
        {
          "internalType": "uint256[]",
          "name": "topIds",
          "type": "uint256[]"
        }
      ],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "name": "tip",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "name": "vote",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "voteThreshold",
      "outputs": [
        {
          "internalType": "uint256",
          "name": "",
          "type": "uint256"
        }
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        {
          "internalType": "uint256",
          "name": "id",
          "type": "uint256"
        }
      ],
      "name": "withdraw",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ],
  "profile": {
    "address": "0x1d057b116e208dfb83D8D9c9D3E360442311AaDE",
    "abi": [
      {
        "inputs": [
          {
            "internalType": "address",
            "name": "scoutAddress",
            "type": "address"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "constructor"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "cardId",
            "type": "uint256"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "author",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "bytes32",
            "name": "contentHash",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "internalType": "uint32",
            "name": "version",
            "type": "uint32"
          }
        ],
        "name": "ProfileSet",
        "type": "event"
      },
      {
        "anonymous": false,
        "inputs": [
          {
            "indexed": true,
            "internalType": "uint256",
            "name": "cardId",
            "type": "uint256"
          },
          {
            "indexed": true,
            "internalType": "address",
            "name": "author",
            "type": "address"
          },
          {
            "indexed": false,
            "internalType": "bytes32",
            "name": "prevHash",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "internalType": "bytes32",
            "name": "contentHash",
            "type": "bytes32"
          },
          {
            "indexed": false,
            "internalType": "uint32",
            "name": "version",
            "type": "uint32"
          }
        ],
        "name": "ProfileUpdated",
        "type": "event"
      },
      {
        "inputs": [],
        "name": "MAX_JSON",
        "outputs": [
          {
            "internalType": "uint256",
            "name": "",
            "type": "uint256"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "cardId",
            "type": "uint256"
          }
        ],
        "name": "getHashHistory",
        "outputs": [
          {
            "internalType": "bytes32[]",
            "name": "",
            "type": "bytes32[]"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "cardId",
            "type": "uint256"
          }
        ],
        "name": "getProfile",
        "outputs": [
          {
            "components": [
              {
                "internalType": "bytes32",
                "name": "contentHash",
                "type": "bytes32"
              },
              {
                "internalType": "string",
                "name": "json",
                "type": "string"
              },
              {
                "internalType": "uint64",
                "name": "updatedAt",
                "type": "uint64"
              },
              {
                "internalType": "uint32",
                "name": "version",
                "type": "uint32"
              }
            ],
            "internalType": "struct ProfileRegistry.Profile",
            "name": "",
            "type": "tuple"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "cardId",
            "type": "uint256"
          }
        ],
        "name": "hasProfile",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [],
        "name": "scout",
        "outputs": [
          {
            "internalType": "contract ITalentScout",
            "name": "",
            "type": "address"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "cardId",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "json",
            "type": "string"
          }
        ],
        "name": "setProfile",
        "outputs": [
          {
            "internalType": "bytes32",
            "name": "contentHash",
            "type": "bytes32"
          },
          {
            "internalType": "uint32",
            "name": "version",
            "type": "uint32"
          }
        ],
        "stateMutability": "nonpayable",
        "type": "function"
      },
      {
        "inputs": [
          {
            "internalType": "uint256",
            "name": "cardId",
            "type": "uint256"
          },
          {
            "internalType": "string",
            "name": "json",
            "type": "string"
          }
        ],
        "name": "verify",
        "outputs": [
          {
            "internalType": "bool",
            "name": "",
            "type": "bool"
          }
        ],
        "stateMutability": "view",
        "type": "function"
      }
    ]
  }
};
