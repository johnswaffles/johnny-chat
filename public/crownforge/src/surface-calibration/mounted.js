// Rider surfaces only. Coordinates are absolute pixels in each active source
// PNG, including Scout's profile-torso and both profile-hand supplements.
// Hand roots follow the wrist crease/cuff exit; original grip targets remain.
// All forearms end in bracers, so leather-to-wrist joins stay crisp, not faded.
export default {
  scout: {
    profileSockets: { right: [283, 275], left: [1254, 278] },
    views: {
      front: {
        left: {
          hand: { root: [385, 905], width: 5.0, palmLength: 4.5, bare: false },
          lower: { tip: [650, 706], width: 6.0 },
          upper: { root: [138, 453], tip: [112, 724], width: 8.2 },
          sleeveOverForearm: true,
        },
        right: {
          hand: { root: [126, 906], width: 5.0, palmLength: 4.5, bare: false },
          lower: { tip: [878, 705], width: 6.0 },
          upper: { root: [358, 454], tip: [398, 724], width: 8.2 },
          sleeveOverForearm: true,
        },
      },
      right: {
        left: {
          hand: { root: [370, 155], width: 5.6, palmLength: 4.6, bare: false },
          lower: { tip: [668, 700], width: 6.0 },
          upper: { root: [140, 451], tip: [149, 708], width: 8.2 },
          sleeveOverForearm: true,
        },
        right: {
          hand: { root: [952, 158], width: 5.6, palmLength: 4.6, bare: false },
          lower: { tip: [870, 699], width: 6.0 },
          upper: { root: [396, 450], tip: [390, 709], width: 8.2 },
          sleeveOverForearm: true,
        },
      },
      back: {
        left: {
          hand: { root: [120, 899], width: 5.0, palmLength: 4.5, bare: false },
          lower: { tip: [640, 711], width: 6.0 },
          upper: { root: [132, 449], tip: [121, 729], width: 8.2 },
          sleeveOverForearm: true,
        },
        right: {
          hand: { root: [400, 899], width: 5.0, palmLength: 4.5, bare: false },
          lower: { tip: [872, 711], width: 6.0 },
          upper: { root: [377, 450], tip: [403, 727], width: 8.2 },
          sleeveOverForearm: true,
        },
      },
      left: {
        left: {
          hand: { root: [352, 738], width: 5.6, palmLength: 4.6, bare: false },
          lower: { tip: [570, 866], width: 6.0 },
          upper: { root: [108, 555], tip: [127, 885], width: 8.2 },
          sleeveOverForearm: true,
        },
        right: {
          hand: { root: [956, 736], width: 5.6, palmLength: 4.6, bare: false },
          lower: { tip: [943, 864], width: 6.0 },
          upper: { root: [400, 554], tip: [398, 885], width: 8.2 },
          sleeveOverForearm: true,
        },
      },
    },
  },
  ashenOutrider: {
    profileSockets: { right: [573, 127], left: [481, 131] },
    views: {
      front: {
        left: {
          hand: { root: [490, 688], width: 5.1, palmLength: 4.5, bare: false },
          lower: { tip: [794, 575], width: 6.0 },
          upper: { root: [130, 398], tip: [113, 601], width: 8.2 },
          sleeveOverForearm: false,
        },
        right: {
          hand: { root: [146, 684], width: 5.1, palmLength: 4.5, bare: false },
          lower: { tip: [1053, 576], width: 6.0 },
          upper: { root: [516, 403], tip: [539, 609], width: 8.2 },
          sleeveOverForearm: false,
        },
      },
      right: {
        left: {
          hand: { root: [319, 126], width: 5.6, palmLength: 4.7, bare: false },
          lower: { tip: [908, 501], width: 6.2 },
          upper: { root: [202, 360], tip: [170, 550], width: 8.2 },
          sleeveOverForearm: false,
        },
        right: {
          hand: { root: [895, 127], width: 5.6, palmLength: 4.7, bare: false },
          lower: { tip: [1114, 508], width: 6.2 },
          upper: { root: [512, 358], tip: [538, 551], width: 8.2 },
          sleeveOverForearm: false,
        },
      },
      back: {
        left: {
          hand: { root: [222, 607], width: 5.1, palmLength: 4.5, bare: false },
          lower: { tip: [881, 516], width: 6.0 },
          upper: { root: [210, 341], tip: [187, 538], width: 8.2 },
          sleeveOverForearm: false,
        },
        right: {
          hand: { root: [556, 612], width: 5.1, palmLength: 4.5, bare: false },
          lower: { tip: [1184, 523], width: 6.0 },
          upper: { root: [570, 342], tip: [584, 540], width: 8.2 },
          sleeveOverForearm: false,
        },
      },
      left: {
        left: {
          hand: { root: [335, 734], width: 5.6, palmLength: 4.7, bare: false },
          lower: { tip: [749, 586], width: 6.0 },
          upper: { root: [190, 385], tip: [157, 598], width: 8.2 },
          sleeveOverForearm: false,
        },
        right: {
          hand: { root: [922, 731], width: 5.6, palmLength: 4.7, bare: false },
          lower: { tip: [979, 586], width: 6.0 },
          upper: { root: [470, 387], tip: [496, 600], width: 8.2 },
          sleeveOverForearm: false,
        },
      },
    },
  },
};
