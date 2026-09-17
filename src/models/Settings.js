const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  gstRate: {
    type: Number,
    default: 0.03,
    min: [0, 'GST rate cannot be negative'],
    max: [18, 'GST rate cannot exceed 18']
  },
  cgstRate: {
    type: Number,
    default: 0.015
  },
  sgstRate: {
    type: Number,
    default: 0.015
  },
  freeShippingThreshold: {
    type: Number,
    default: 5000
  },
  metroShippingCharge: {
    type: Number,
    default: 50
  },
  standardShippingCharge: {
    type: Number,
    default: 100
  },
  metroPincodes: {
    type: [String],
    default: ['400001', '110001', '600001', '700001', '500001', '560001']
  },
  // Product-page tabs. Admin can hide a tab or rename its label; DESCRIPTION
  // is always kept visible so the page can never render with no tabs at all.
  productTabs: {
    description: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'DESCRIPTION', trim: true, maxlength: 30 }
    },
    details: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'DETAILS', trim: true, maxlength: 30 }
    },
    reviews: {
      enabled: { type: Boolean, default: true },
      label: { type: String, default: 'REVIEWS', trim: true, maxlength: 30 }
    }
  },
  // Homepage "services" strip (Quality Certified / Free Shipping / ...).
  // Fully admin-editable: text, icon and visibility per item. Defaults match
  // what the storefront hardcoded before this became configurable.
  serviceHighlights: {
    type: [
      {
        icon: {
          type: String,
          default: 'diamond',
          trim: true,
          // Keys map to a fixed icon set in the storefront; an unknown key
          // falls back to the diamond rather than rendering nothing.
          enum: ['diamond', 'lock', 'truck', 'people', 'shield', 'gift', 'star', 'headset']
        },
        title: { type: String, default: '', trim: true, maxlength: 60 },
        subtitle: { type: String, default: '', trim: true, maxlength: 120 },
        enabled: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 }
      }
    ],
    default: [
      { icon: 'diamond', title: 'Quality Certified', subtitle: 'Available certificates of Authenticity', enabled: true, displayOrder: 1 },
      { icon: 'lock', title: 'Secure Transaction', subtitle: 'Certified Marketplace still 2017', enabled: true, displayOrder: 2 },
      { icon: 'truck', title: 'Free Shipping', subtitle: 'Free, Fast And Reliable Worldwide', enabled: true, displayOrder: 3 },
      { icon: 'people', title: 'Transparent Services', subtitle: 'Satisfying hassle-free return policy', enabled: true, displayOrder: 4 }
    ]
  },
  // Lets the admin hide the whole strip without deleting its items.
  serviceHighlightsEnabled: {
    type: Boolean,
    default: true
  },

  // Homepage FAQ accordion. Same model as the services strip: fully editable
  // text, per-item visibility, explicit ordering.
  faqs: {
    type: [
      {
        question: { type: String, default: '', trim: true, maxlength: 300 },
        answer: { type: String, default: '', trim: true, maxlength: 2000 },
        enabled: { type: Boolean, default: true },
        displayOrder: { type: Number, default: 0 }
      }
    ],
    default: [
      {
        question: 'Are your products certified and of high quality?',
        answer: 'Yes, all of our products are crafted with the highest quality materials and undergo thorough quality checks. We also provide certificates of authenticity for our diamond and gemstone jewelry.',
        enabled: true,
        displayOrder: 1
      },
      {
        question: 'What payment methods do you accept?',
        answer: 'We accept various payment methods including credit cards (Visa, MasterCard, American Express), PayPal, bank transfers, and installment payment options through our financing partners.',
        enabled: true,
        displayOrder: 2
      },
      {
        question: 'Do you offer customization options for jewelry?',
        answer: 'Yes, we offer comprehensive customization services. You can customize ring settings, engrave special messages, choose different gemstones, and work with our designers to create unique pieces that match your style and preferences.',
        enabled: true,
        displayOrder: 3
      }
    ]
  },
  faqTitle: {
    type: String,
    default: 'FAQ',
    trim: true,
    maxlength: 80
  },
  faqsEnabled: {
    type: Boolean,
    default: true
  },

  // About page "Our Journey" section. Heading sits left, paragraphs right.
  // Text is fully admin-editable; there is deliberately no image here.
  aboutJourney: {
    heading: { type: String, default: 'Our Journey', trim: true, maxlength: 120 },
    paragraphs: {
      type: [String],
      default: [
        "The journey of Feauag is a tale of relentless passion and unwavering dedication. It began with a vision—a vision to redefine luxury, to make it more than just a material possession, but a tangible expression of the heart's deepest emotions. Founded by a team of artisans, designers, and dreamers, Feauag came to life as a response to the impersonal nature of mass-produced jewelry. We recognized the need for jewelry that tells a story, jewelry that becomes a part of your life's narrative, jewelry that carries your memories and milestones.",
        'From our humble beginnings, we embarked on a path of discovery, craftsmanship, and creativity. Our ateliers became the canvas where ideas turned into reality, where raw materials transformed into treasures, and where every piece was imbued with a touch of artistry.',
        'As we grew, so did our commitment to the art of fine jewelry. Each creation that left our workshop was a testament to our dedication to excellence. We knew that our pieces were not mere adornments but symbols of love, commitment, and personal identity.',
        "Over the years, Feauag has become a name synonymous with grace and sophistication. Our jewelry has graced the most intimate moments in people's lives—engagements, weddings, anniversaries, and more. We've celebrated with you as you marked achievements, milestones, and personal victories.",
        "Our journey has been a constant evolution, fueled by the stories you've shared with us. Your trust and loyalty have been our guiding stars, inspiring us to continually push the boundaries of creativity and craftsmanship.",
        'Today, as we look back on our journey, we remain humbled by the love and support we\'ve received from our valued customers. But we also look forward with boundless enthusiasm, as we continue to explore new horizons and create jewelry that is not just beautiful but meaningful.',
        "As Feauag continues to evolve, we invite you to be a part of our journey. Explore our collections, share in our passion for artistry, and let us be a part of your life's most beautiful moments. With Feauag, your journey meets our craftsmanship, and together, we create stories that last a lifetime. Thank you for being a part of the Feauag story—a story that weaves together love, art, and timeless elegance."
      ]
    },
    enabled: { type: Boolean, default: true }
  },

  // About page "Craftsmanship" section. Same two-column shape as the journey,
  // but each block has an optional bold label above its body copy.
  // About page "Company Values" section. Same two-column shape: heading left,
  // accent-barred value blocks right.
  aboutValues: {
    heading: { type: String, default: 'Company Values', trim: true, maxlength: 120 },
    items: {
      type: [
        {
          title: { type: String, default: '', trim: true, maxlength: 120 },
          body: { type: String, default: '', trim: true, maxlength: 2000 }
        }
      ],
      default: [
        {
          title: 'Excellence',
          body: 'We are committed to the relentless pursuit of excellence in everything we do. From the craftsmanship of our jewelry to the service we provide, we strive for perfection, knowing that excellence is the foundation of enduring beauty.'
        },
        {
          title: 'Integrity',
          body: 'Integrity is the cornerstone of our business. We operate with transparency, honesty, and fairness in all our interactions—with our customers, partners, and within our team. Trust is the bedrock of our relationships.'
        },
        {
          title: 'Artistry',
          body: 'We celebrate the artistry of fine jewelry. Our creations are not just accessories; they are works of art that embody creativity and passion. We believe that every piece should tell a unique story.'
        },
        {
          title: 'Customer-Centric',
          body: 'Our customers are at the heart of everything we do. We listen to your needs, understand your desires, and strive to exceed your expectations. Your satisfaction is our ultimate goal.'
        },
        {
          title: 'Ethical Sourcing',
          body: 'We are committed to responsible and ethical sourcing of materials. Our dedication to sustainability and ethical practices ensures that our jewelry not only reflects beauty but also respect for our planet and its people.'
        },
        {
          title: 'Personalization',
          body: 'We understand that jewelry is deeply personal. We embrace customization and personalization, allowing you to create pieces that reflect your individuality and commemorate your most cherished moments.'
        }
      ]
    },
    enabled: { type: Boolean, default: true }
  },

  // About page closing call-to-action.
  aboutCta: {
    heading: { type: String, default: "Let's Work with Us!", trim: true, maxlength: 160 },
    subtext: { type: String, default: '', trim: true, maxlength: 400 },
    buttonText: { type: String, default: 'Work With Us', trim: true, maxlength: 60 },
    buttonLink: { type: String, default: '/contact', trim: true, maxlength: 300 },
    enabled: { type: Boolean, default: true }
  },

  aboutCraftsmanship: {
    heading: { type: String, default: 'Craftmanship', trim: true, maxlength: 120 },
    intro: {
      type: String,
      default: "At Feauag, craftsmanship is not just a skill; it's an art form. We believe that every piece of jewelry should be a masterpiece, meticulously crafted to stand the test of time and capture the essence of its wearer. Our commitment to excellence in craftsmanship is at the heart of everything we do.",
      trim: true,
      maxlength: 2000
    },
    blocks: {
      type: [
        {
          label: { type: String, default: '', trim: true, maxlength: 120 },
          body: { type: String, default: '', trim: true, maxlength: 2000 }
        }
      ],
      default: [
        {
          label: 'The Artisans:',
          body: 'Our artisans are the true guardians of our craft. With years of experience and a profound passion for their work, they bring each design to life with precision and artistry. From the moment a concept takes shape to the final finishing touches, our artisans pour their heart and soul into every piece. Their attention to detail ensures that every facet of a diamond sparkles brilliantly, and every curve of a metal setting is flawless.'
        },
        {
          label: 'Uncompromising Quality:',
          body: 'We source only the finest materials to create our jewelry. From the ethically-sourced diamonds and gemstones to the high-quality metals, we spare no effort in ensuring that each component meets the highest standards of quality. Our commitment to ethical sourcing and sustainability extends to every facet of our creations, so you can wear our jewelry with pride, knowing it aligns with your values.'
        },
        {
          label: 'Time-Honored Techniques:',
          body: "While we embrace innovation and contemporary design, we also hold onto time-honored jewelry-making techniques. Our ateliers blend modern technology with traditional craftsmanship, resulting in pieces that marry the best of both worlds. It's this blend of old and new that gives our jewelry a timeless quality, making it relevant and cherished for generations."
        },
        {
          label: 'Customization and Personalization:',
          body: "We understand that jewelry is an intimate form of self-expression. That's why we offer customization and personalization options, allowing you to create a piece that is uniquely yours. Whether it's engraving a special date, selecting your preferred metal, or choosing a specific gemstone, our artisans are here to bring your vision to life."
        },
        {
          label: 'Quality Assurance:',
          body: 'Before each piece leaves our workshop, it undergoes rigorous quality control. We inspect every detail to ensure it meets our exacting standards, so the jewelry that reaches you is nothing short of perfect.'
        }
      ]
    },
    enabled: { type: Boolean, default: true }
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

/**
 * Get the singleton settings document.
 * Creates one with defaults if none exists.
 */
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

const Settings = mongoose.model('Settings', settingsSchema);

module.exports = Settings;
