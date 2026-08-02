export const TAXONOMY_VERSION = "2026.1" as const;

type RawSpecificCategory = readonly [key: string, name: string];
interface RawUsageGroup {
  key: string;
  name: string;
  categories: readonly RawSpecificCategory[];
}
interface RawDomain {
  key: string;
  name: string;
  groups: readonly RawUsageGroup[];
}

const RAW_TAXONOMY: readonly RawDomain[] = [
  {
    key: "everyday_life",
    name: "Everyday Life",
    groups: [
      {
        key: "routines",
        name: "Routines",
        categories: [
          ["morning_routines", "Morning routines"],
          ["meals_and_breaks", "Meals and breaks"],
          ["errands_and_appointments", "Errands and appointments"],
          ["evening_routines", "Evening routines"],
          ["weekends_and_leisure", "Weekends and leisure"],
        ],
      },
      {
        key: "time_planning",
        name: "Time & Planning",
        categories: [
          ["schedules_and_deadlines", "Schedules and deadlines"],
          ["frequency_and_habits", "Frequency and habits"],
          ["punctuality_and_delays", "Punctuality and delays"],
          ["priorities_and_choices", "Priorities and choices"],
          ["changes_of_plan", "Changes of plan"],
        ],
      },
      {
        key: "practical_actions",
        name: "Practical Actions",
        categories: [
          ["starting_and_finishing", "Starting and finishing"],
          ["carrying_and_moving", "Carrying and moving things"],
          ["finding_and_losing", "Finding and losing things"],
          ["fixing_and_replacing", "Fixing and replacing"],
          ["waiting_and_queueing", "Waiting and queueing"],
        ],
      },
      {
        key: "personal_needs",
        name: "Personal Needs",
        categories: [
          ["comfort_and_discomfort", "Comfort and discomfort"],
          ["clothing_and_appearance", "Clothing and appearance"],
          ["hygiene_and_self_care", "Hygiene and self-care"],
          ["sleep_and_rest", "Sleep and rest"],
          ["everyday_requests", "Everyday requests"],
        ],
      },
    ],
  },
  {
    key: "home",
    name: "Home",
    groups: [
      {
        key: "rooms_and_spaces",
        name: "Rooms & Spaces",
        categories: [
          ["kitchen_activities", "Kitchen activities"],
          ["bathroom_use", "Bathroom use"],
          ["bedroom_and_sleeping", "Bedroom and sleeping"],
          ["living_room_activities", "Living-room activities"],
          ["storage_and_organization", "Storage and organization"],
        ],
      },
      {
        key: "household_management",
        name: "Household Management",
        categories: [
          ["cleaning_and_chores", "Cleaning and chores"],
          ["laundry_and_clothing_care", "Laundry and clothing care"],
          ["shopping_for_the_home", "Shopping for the home"],
          ["sharing_household_tasks", "Sharing household tasks"],
          ["house_rules_and_routines", "House rules and routines"],
        ],
      },
      {
        key: "utilities_and_maintenance",
        name: "Utilities & Maintenance",
        categories: [
          ["electricity_and_power", "Electricity and power"],
          ["water_and_plumbing", "Water and plumbing"],
          ["heating_and_cooling", "Heating and cooling"],
          ["repairs_and_tradespeople", "Repairs and tradespeople"],
          ["rent_and_household_bills", "Rent and household bills"],
        ],
      },
      {
        key: "neighborhood_living",
        name: "Neighborhood Living",
        categories: [
          ["neighbors_and_shared_spaces", "Neighbors and shared spaces"],
          ["noise_and_disturbance", "Noise and disturbance"],
          ["deliveries_and_visitors", "Deliveries and visitors"],
          ["safety_and_security", "Home safety and security"],
          ["moving_home", "Moving home"],
        ],
      },
    ],
  },
  {
    key: "relationships",
    name: "Relationships",
    groups: [
      {
        key: "family",
        name: "Family",
        categories: [
          ["family_roles", "Family roles"],
          ["parenting_and_children", "Parenting and children"],
          ["extended_family", "Extended family"],
          ["family_events", "Family events"],
          ["family_responsibilities", "Family responsibilities"],
        ],
      },
      {
        key: "friendship",
        name: "Friendship",
        categories: [
          ["making_friends", "Making friends"],
          ["keeping_in_touch", "Keeping in touch"],
          ["sharing_and_support", "Sharing and support"],
          ["social_plans", "Social plans"],
          ["friendship_boundaries", "Friendship boundaries"],
        ],
      },
      {
        key: "romantic_relationships",
        name: "Romantic Relationships",
        categories: [
          ["dating_and_attraction", "Dating and attraction"],
          ["commitment_and_partnership", "Commitment and partnership"],
          ["affection_and_closeness", "Affection and closeness"],
          ["relationship_expectations", "Relationship expectations"],
          ["separation_and_breakups", "Separation and breakups"],
        ],
      },
      {
        key: "conflict_and_support",
        name: "Conflict & Support",
        categories: [
          ["disagreements", "Disagreements"],
          ["apologizing_and_forgiving", "Apologizing and forgiving"],
          ["trust_and_honesty", "Trust and honesty"],
          ["comforting_someone", "Comforting someone"],
          ["setting_boundaries", "Setting boundaries"],
        ],
      },
    ],
  },
  {
    key: "communication",
    name: "Communication",
    groups: [
      {
        key: "social_interaction",
        name: "Social Interaction",
        categories: [
          ["greetings_and_introductions", "Greetings and introductions"],
          ["small_talk", "Small talk"],
          ["invitations_and_responses", "Invitations and responses"],
          ["compliments_and_reactions", "Compliments and reactions"],
          ["goodbyes_and_follow_up", "Goodbyes and follow-up"],
        ],
      },
      {
        key: "conversation_management",
        name: "Conversation Management",
        categories: [
          ["taking_turns", "Taking turns"],
          ["interrupting_politely", "Interrupting politely"],
          ["clarifying_meaning", "Clarifying meaning"],
          ["changing_the_subject", "Changing the subject"],
          ["ending_a_conversation", "Ending a conversation"],
        ],
      },
      {
        key: "information_exchange",
        name: "Information Exchange",
        categories: [
          ["asking_for_information", "Asking for information"],
          ["giving_instructions", "Giving instructions"],
          ["explaining_a_process", "Explaining a process"],
          ["checking_understanding", "Checking understanding"],
          ["reporting_updates", "Reporting updates"],
        ],
      },
      {
        key: "persuasion_and_discussion",
        name: "Persuasion & Discussion",
        categories: [
          ["expressing_opinions", "Expressing opinions"],
          ["agreeing_and_disagreeing", "Agreeing and disagreeing"],
          ["giving_reasons", "Giving reasons"],
          ["making_suggestions", "Making suggestions"],
          ["persuading_and_negotiating", "Persuading and negotiating"],
        ],
      },
    ],
  },
  {
    key: "work",
    name: "Work",
    groups: [
      {
        key: "job_search",
        name: "Job Search",
        categories: [
          ["vacancies_and_applications", "Vacancies and applications"],
          ["cv_and_cover_letters", "CVs and cover letters"],
          ["job_interviews", "Job interviews"],
          ["offers_and_contracts", "Offers and contracts"],
          ["starting_a_new_job", "Starting a new job"],
        ],
      },
      {
        key: "workplace_tasks",
        name: "Workplace Tasks",
        categories: [
          ["planning_work", "Planning work"],
          ["emails_and_messages", "Work emails and messages"],
          ["documents_and_reports", "Documents and reports"],
          ["deadlines_and_priorities", "Deadlines and priorities"],
          ["problems_and_solutions", "Work problems and solutions"],
        ],
      },
      {
        key: "meetings_and_collaboration",
        name: "Meetings & Collaboration",
        categories: [
          ["meeting_arrangements", "Meeting arrangements"],
          ["sharing_ideas", "Sharing ideas"],
          ["clarifying_responsibilities", "Clarifying responsibilities"],
          ["decisions_and_action_items", "Decisions and action items"],
          ["progress_updates", "Progress updates"],
        ],
      },
      {
        key: "leadership_and_performance",
        name: "Leadership & Performance",
        categories: [
          ["giving_feedback", "Giving feedback"],
          ["receiving_feedback", "Receiving feedback"],
          ["delegating_tasks", "Delegating tasks"],
          ["performance_and_results", "Performance and results"],
          ["promotion_and_career_growth", "Promotion and career growth"],
        ],
      },
    ],
  },
  {
    key: "education",
    name: "Education",
    groups: [
      {
        key: "classroom_learning",
        name: "Classroom Learning",
        categories: [
          ["lessons_and_subjects", "Lessons and subjects"],
          ["teacher_instructions", "Teacher instructions"],
          ["classroom_participation", "Classroom participation"],
          ["asking_questions", "Asking questions in class"],
          ["group_projects", "Group projects"],
        ],
      },
      {
        key: "study_skills",
        name: "Study Skills",
        categories: [
          ["note_taking", "Note-taking"],
          ["reading_and_comprehension", "Reading and comprehension"],
          ["memorizing_and_reviewing", "Memorizing and reviewing"],
          ["practice_and_improvement", "Practice and improvement"],
          ["study_planning", "Study planning"],
        ],
      },
      {
        key: "exams_and_assessment",
        name: "Exams & Assessment",
        categories: [
          ["exam_preparation", "Exam preparation"],
          ["test_instructions", "Test instructions"],
          ["answers_and_explanations", "Answers and explanations"],
          ["grades_and_results", "Grades and results"],
          ["mistakes_and_corrections", "Mistakes and corrections"],
        ],
      },
      {
        key: "research_and_writing",
        name: "Research & Writing",
        categories: [
          ["finding_sources", "Finding sources"],
          ["academic_arguments", "Academic arguments"],
          ["evidence_and_citations", "Evidence and citations"],
          ["essay_structure", "Essay structure"],
          ["editing_and_revision", "Editing and revision"],
        ],
      },
    ],
  },
  {
    key: "travel",
    name: "Travel",
    groups: [
      {
        key: "planning_and_booking",
        name: "Planning & Booking",
        categories: [
          ["choosing_a_destination", "Choosing a destination"],
          ["trip_planning", "Trip planning"],
          ["booking_tickets", "Booking tickets"],
          ["travel_documents", "Travel documents"],
          ["packing_and_luggage", "Packing and luggage"],
        ],
      },
      {
        key: "airports_and_flights",
        name: "Airports & Flights",
        categories: [
          ["check_in_and_baggage", "Check-in and baggage"],
          ["security_and_immigration", "Security and immigration"],
          ["boarding_and_gates", "Boarding and gates"],
          ["on_the_plane", "On the plane"],
          [
            "flight_delays_and_cancellations",
            "Flight delays and cancellations",
          ],
        ],
      },
      {
        key: "accommodation",
        name: "Accommodation",
        categories: [
          ["hotel_booking", "Hotel booking"],
          ["checking_in_at_a_hotel", "Checking in at a hotel"],
          ["rooms_and_facilities", "Rooms and facilities"],
          ["requests_and_services", "Hotel requests and services"],
          ["accommodation_problems", "Accommodation problems"],
        ],
      },
      {
        key: "sightseeing_and_problems",
        name: "Sightseeing & Problems",
        categories: [
          ["tourist_information", "Tourist information"],
          ["tours_and_attractions", "Tours and attractions"],
          ["photos_and_memories", "Photos and memories"],
          ["lost_items_and_documents", "Lost items and documents"],
          ["travel_emergencies", "Travel emergencies"],
        ],
      },
    ],
  },
  {
    key: "transport",
    name: "Transport",
    groups: [
      {
        key: "public_transport",
        name: "Public Transport",
        categories: [
          ["bus_travel", "Bus travel"],
          ["train_travel", "Train travel"],
          ["metro_and_tram", "Metro and tram"],
          ["tickets_and_fares", "Tickets and fares"],
          ["stations_and_platforms", "Stations and platforms"],
        ],
      },
      {
        key: "driving",
        name: "Driving",
        categories: [
          ["cars_and_controls", "Cars and controls"],
          ["traffic_and_road_rules", "Traffic and road rules"],
          ["parking", "Parking"],
          ["fuel_and_charging", "Fuel and charging"],
          ["car_problems", "Car problems"],
        ],
      },
      {
        key: "directions_and_routes",
        name: "Directions & Routes",
        categories: [
          ["asking_for_directions", "Asking for directions"],
          ["giving_directions", "Giving directions"],
          ["maps_and_navigation", "Maps and navigation"],
          ["distances_and_journey_times", "Distances and journey times"],
          ["choosing_a_route", "Choosing a route"],
        ],
      },
      {
        key: "disruptions_and_safety",
        name: "Disruptions & Safety",
        categories: [
          ["traffic_delays", "Traffic delays"],
          ["missed_connections", "Missed connections"],
          ["breakdowns_and_repairs", "Breakdowns and repairs"],
          ["accidents_and_safety", "Accidents and safety"],
          ["transport_complaints", "Transport complaints"],
        ],
      },
    ],
  },
  {
    key: "shopping_money",
    name: "Shopping & Money",
    groups: [
      {
        key: "shopping_decisions",
        name: "Shopping Decisions",
        categories: [
          ["needs_and_preferences", "Needs and preferences"],
          ["comparing_products", "Comparing products"],
          ["size_color_and_fit", "Size, color and fit"],
          ["quality_and_value", "Quality and value"],
          ["availability_and_stock", "Availability and stock"],
        ],
      },
      {
        key: "store_interactions",
        name: "Store Interactions",
        categories: [
          ["asking_for_help", "Asking for help in a store"],
          ["finding_products", "Finding products"],
          ["trying_items", "Trying items"],
          ["offers_and_discounts", "Offers and discounts"],
          ["checkout_and_receipts", "Checkout and receipts"],
        ],
      },
      {
        key: "payments_and_banking",
        name: "Payments & Banking",
        categories: [
          ["cash_and_cards", "Cash and cards"],
          ["prices_and_costs", "Prices and costs"],
          ["bank_accounts", "Bank accounts"],
          ["transfers_and_payments", "Transfers and payments"],
          ["saving_and_budgeting", "Saving and budgeting"],
        ],
      },
      {
        key: "returns_and_consumer_problems",
        name: "Returns & Consumer Problems",
        categories: [
          ["returns_and_exchanges", "Returns and exchanges"],
          ["refunds", "Refunds"],
          ["faulty_products", "Faulty products"],
          ["delivery_problems", "Delivery problems"],
          ["complaints_and_consumer_rights", "Complaints and consumer rights"],
        ],
      },
    ],
  },
  {
    key: "food",
    name: "Food & Drink",
    groups: [
      {
        key: "ingredients_and_taste",
        name: "Ingredients & Taste",
        categories: [
          ["fruit_and_vegetables", "Fruit and vegetables"],
          ["meat_fish_and_protein", "Meat, fish and protein"],
          ["spices_and_flavors", "Spices and flavors"],
          ["texture_and_taste", "Texture and taste"],
          ["dietary_needs", "Dietary needs"],
        ],
      },
      {
        key: "cooking",
        name: "Cooking",
        categories: [
          ["preparing_ingredients", "Preparing ingredients"],
          ["cooking_methods", "Cooking methods"],
          ["recipes_and_measurements", "Recipes and measurements"],
          ["kitchen_tools", "Kitchen tools"],
          ["cooking_problems", "Cooking problems"],
        ],
      },
      {
        key: "eating_at_home",
        name: "Eating at Home",
        categories: [
          ["breakfast", "Breakfast"],
          ["lunch_and_dinner", "Lunch and dinner"],
          ["snacks_and_drinks", "Snacks and drinks"],
          ["serving_food", "Serving food"],
          ["leftovers_and_storage", "Leftovers and storage"],
        ],
      },
      {
        key: "restaurants_and_cafes",
        name: "Restaurants & Cafés",
        categories: [
          ["booking_a_table", "Booking a table"],
          ["ordering_food", "Ordering food"],
          ["asking_about_the_menu", "Asking about the menu"],
          ["service_and_special_requests", "Service and special requests"],
          ["paying_and_complaining", "Paying and complaining"],
        ],
      },
    ],
  },
  {
    key: "health",
    name: "Health",
    groups: [
      {
        key: "body_and_symptoms",
        name: "Body & Symptoms",
        categories: [
          ["body_parts", "Body parts"],
          ["pain_and_discomfort", "Pain and discomfort"],
          ["cold_flu_and_fever", "Cold, flu and fever"],
          ["stomach_and_digestion", "Stomach and digestion"],
          ["injuries_and_swelling", "Injuries and swelling"],
        ],
      },
      {
        key: "medical_appointments",
        name: "Medical Appointments",
        categories: [
          ["booking_an_appointment", "Booking an appointment"],
          ["describing_symptoms", "Describing symptoms"],
          ["medical_questions", "Medical questions"],
          ["tests_and_results", "Tests and results"],
          ["referrals_and_follow_up", "Referrals and follow-up"],
        ],
      },
      {
        key: "treatment_and_recovery",
        name: "Treatment & Recovery",
        categories: [
          ["medication_and_dosage", "Medication and dosage"],
          ["treatment_instructions", "Treatment instructions"],
          [
            "physiotherapy_and_rehabilitation",
            "Physiotherapy and rehabilitation",
          ],
          ["recovery_and_progress", "Recovery and progress"],
          ["side_effects_and_concerns", "Side effects and concerns"],
        ],
      },
      {
        key: "fitness_and_wellbeing",
        name: "Fitness & Wellbeing",
        categories: [
          ["exercise_and_training", "Exercise and training"],
          ["strength_and_mobility", "Strength and mobility"],
          ["nutrition_and_weight", "Nutrition and weight"],
          ["stress_and_relaxation", "Stress and relaxation"],
          ["healthy_habits", "Healthy habits"],
        ],
      },
    ],
  },
  {
    key: "technology_media",
    name: "Technology & Media",
    groups: [
      {
        key: "devices_and_hardware",
        name: "Devices & Hardware",
        categories: [
          ["phones_and_tablets", "Phones and tablets"],
          ["computers_and_accessories", "Computers and accessories"],
          ["settings_and_controls", "Settings and controls"],
          ["battery_and_charging", "Battery and charging"],
          ["hardware_problems", "Hardware problems"],
        ],
      },
      {
        key: "internet_and_accounts",
        name: "Internet & Accounts",
        categories: [
          ["internet_connections", "Internet connections"],
          ["accounts_and_passwords", "Accounts and passwords"],
          ["privacy_and_security", "Privacy and security"],
          ["online_payments", "Online payments"],
          ["social_media_accounts", "Social-media accounts"],
        ],
      },
      {
        key: "software_and_data",
        name: "Software & Data",
        categories: [
          ["installing_and_updating", "Installing and updating"],
          ["files_and_folders", "Files and folders"],
          ["apps_and_features", "Apps and features"],
          ["errors_and_troubleshooting", "Errors and troubleshooting"],
          ["backups_and_syncing", "Backups and syncing"],
        ],
      },
      {
        key: "media_and_news",
        name: "Media & News",
        categories: [
          ["news_reports", "News reports"],
          ["articles_and_headlines", "Articles and headlines"],
          ["online_videos", "Online videos"],
          ["podcasts_and_broadcasts", "Podcasts and broadcasts"],
          ["misinformation_and_sources", "Misinformation and sources"],
        ],
      },
    ],
  },
  {
    key: "culture_entertainment",
    name: "Culture & Entertainment",
    groups: [
      {
        key: "books_and_arts",
        name: "Books & Arts",
        categories: [
          ["fiction_and_storytelling", "Fiction and storytelling"],
          ["nonfiction_and_ideas", "Nonfiction and ideas"],
          ["visual_arts", "Visual arts"],
          ["theatre_and_performance", "Theatre and performance"],
          ["reviews_and_interpretation", "Reviews and interpretation"],
        ],
      },
      {
        key: "films_and_television",
        name: "Films & Television",
        categories: [
          ["genres_and_styles", "Genres and styles"],
          ["plot_and_characters", "Plot and characters"],
          ["action_and_tension", "Action and tension"],
          ["acting_and_production", "Acting and production"],
          ["recommendations_and_reviews", "Recommendations and reviews"],
        ],
      },
      {
        key: "music_and_events",
        name: "Music & Events",
        categories: [
          ["music_genres", "Music genres"],
          ["songs_and_performers", "Songs and performers"],
          ["concerts_and_festivals", "Concerts and festivals"],
          ["tickets_and_venues", "Tickets and venues"],
          ["audience_reactions", "Audience reactions"],
        ],
      },
      {
        key: "hobbies_and_games",
        name: "Hobbies & Games",
        categories: [
          ["creative_hobbies", "Creative hobbies"],
          ["sports_and_activities", "Sports and activities"],
          ["board_and_card_games", "Board and card games"],
          ["video_games", "Video games"],
          ["collecting_and_projects", "Collecting and projects"],
        ],
      },
    ],
  },
  {
    key: "society_nature",
    name: "Society & Nature",
    groups: [
      {
        key: "community_and_civic_life",
        name: "Community & Civic Life",
        categories: [
          ["local_community", "Local community"],
          ["volunteering_and_charity", "Volunteering and charity"],
          ["public_events", "Public events"],
          [
            "elections_and_civic_participation",
            "Elections and civic participation",
          ],
          ["social_change", "Social change"],
        ],
      },
      {
        key: "public_services",
        name: "Public Services",
        categories: [
          ["government_offices", "Government offices"],
          ["forms_and_applications", "Forms and applications"],
          ["schools_and_local_services", "Schools and local services"],
          ["police_and_emergency_services", "Police and emergency services"],
          ["benefits_and_support", "Benefits and support"],
        ],
      },
      {
        key: "environment_and_weather",
        name: "Environment & Weather",
        categories: [
          ["weather_conditions", "Weather conditions"],
          ["seasons_and_climate", "Seasons and climate"],
          ["landscapes_and_wildlife", "Landscapes and wildlife"],
          ["pollution_and_waste", "Pollution and waste"],
          [
            "sustainability_and_conservation",
            "Sustainability and conservation",
          ],
        ],
      },
      {
        key: "law_and_current_issues",
        name: "Law & Current Issues",
        categories: [
          ["rules_and_regulations", "Rules and regulations"],
          ["rights_and_responsibilities", "Rights and responsibilities"],
          ["crime_and_justice", "Crime and justice"],
          ["public_debate", "Public debate"],
          ["global_events", "Global events"],
        ],
      },
    ],
  },
  {
    key: "personal_growth",
    name: "Personal Growth",
    groups: [
      {
        key: "emotional_awareness",
        name: "Emotional Awareness",
        categories: [
          ["describing_feelings", "Describing feelings"],
          ["mood_changes", "Mood changes"],
          ["fear_and_worry", "Fear and worry"],
          ["anger_and_frustration", "Anger and frustration"],
          ["happiness_and_satisfaction", "Happiness and satisfaction"],
        ],
      },
      {
        key: "personality_and_behavior",
        name: "Personality & Behavior",
        categories: [
          ["character_traits", "Character traits"],
          ["social_behavior", "Social behavior"],
          ["confidence_and_shyness", "Confidence and shyness"],
          ["patience_and_self_control", "Patience and self-control"],
          ["honesty_and_responsibility", "Honesty and responsibility"],
        ],
      },
      {
        key: "goals_and_habits",
        name: "Goals & Habits",
        categories: [
          ["setting_goals", "Setting goals"],
          ["building_habits", "Building habits"],
          ["motivation_and_discipline", "Motivation and discipline"],
          ["tracking_progress", "Tracking progress"],
          ["overcoming_setbacks", "Overcoming setbacks"],
        ],
      },
      {
        key: "reflection_and_decisions",
        name: "Reflection & Decisions",
        categories: [
          ["understanding_experience", "Understanding experience"],
          ["strengths_and_weaknesses", "Strengths and weaknesses"],
          ["making_decisions", "Making decisions"],
          ["changing_your_mind", "Changing your mind"],
          ["future_plans", "Future plans"],
        ],
      },
    ],
  },
] as const;

export interface TaxonomyPath {
  taxonomyVersion: typeof TAXONOMY_VERSION;
  domainKey: string;
  domainName: string;
  usageGroupKey: string;
  usageGroupName: string;
  categoryKey: string;
  categoryName: string;
}

export const TAXONOMY_DOMAINS = RAW_TAXONOMY.map((domain, domainIndex) => ({
  key: domain.key,
  name: domain.name,
  description: `Vocabulary for ${domain.name.toLowerCase()} situations.`,
  sortOrder: domainIndex + 1,
}));

export const TAXONOMY_USAGE_GROUPS = RAW_TAXONOMY.flatMap((domain) =>
  domain.groups.map((group, groupIndex) => ({
    key: `${domain.key}.${group.key}`,
    domainKey: domain.key,
    name: group.name,
    description: `Usage patterns for ${group.name.toLowerCase()} in ${domain.name.toLowerCase()}.`,
    sortOrder: groupIndex + 1,
  })),
);

export const TAXONOMY_SPECIFIC_CATEGORIES = RAW_TAXONOMY.flatMap((domain) =>
  domain.groups.flatMap((group) =>
    group.categories.map(([categoryKey, categoryName], categoryIndex) => ({
      key: `${domain.key}.${group.key}.${categoryKey}`,
      domainKey: domain.key,
      usageGroupKey: `${domain.key}.${group.key}`,
      name: categoryName,
      description: `Vocabulary used for ${categoryName.toLowerCase()}.`,
      aliases: [categoryName.toLowerCase()],
      sortOrder: categoryIndex + 1,
      status: "active" as const,
      taxonomyVersion: TAXONOMY_VERSION,
    })),
  ),
);

const CATEGORY_BY_KEY = new Map(
  TAXONOMY_SPECIFIC_CATEGORIES.map((category) => [category.key, category]),
);
const GROUP_BY_KEY = new Map(
  TAXONOMY_USAGE_GROUPS.map((group) => [group.key, group]),
);
const DOMAIN_BY_KEY = new Map(
  TAXONOMY_DOMAINS.map((domain) => [domain.key, domain]),
);

export const DEFAULT_TAXONOMY_CATEGORY_KEY =
  "everyday_life.practical_actions.starting_and_finishing";

const LEGACY_CATEGORY_FALLBACKS: Record<string, string> = {
  "Daily Life": "everyday_life.routines.weekends_and_leisure",
  "Daily Routines": "everyday_life.routines.morning_routines",
  "Home Life": "home.household_management.cleaning_and_chores",
  "Family & Relationships": "relationships.family.family_roles",
  "Emotions & Personality":
    "personal_growth.emotional_awareness.describing_feelings",
  "Social Situations": "communication.social_interaction.small_talk",
  "Shopping & Money": "shopping_money.shopping_decisions.needs_and_preferences",
  "Food & Drink": "food.ingredients_and_taste.texture_and_taste",
  "Travel & Transport": "travel.planning_and_booking.trip_planning",
  "Weather & Nature":
    "society_nature.environment_and_weather.weather_conditions",
  "School & Learning": "education.study_skills.practice_and_improvement",
  "Work & Business": "work.workplace_tasks.planning_work",
  "Technology & Media": "technology_media.software_and_data.apps_and_features",
  "Health & Body": "health.medical_appointments.describing_symptoms",
  "Culture & Entertainment":
    "culture_entertainment.films_and_television.recommendations_and_reviews",
  "Real-Life Problems":
    "communication.information_exchange.explaining_a_process",
  "Social Skills": "communication.conversation_management.clarifying_meaning",
  "Opinions & Ideas":
    "communication.persuasion_and_discussion.expressing_opinions",
  "Modern Life Topics": "society_nature.law_and_current_issues.public_debate",
  "Personal Growth": "personal_growth.goals_and_habits.setting_goals",
  "Community & Society":
    "society_nature.community_and_civic_life.local_community",
  "Advanced Conversation": "communication.conversation_management.taking_turns",
  "Professional Mastery":
    "work.leadership_and_performance.performance_and_results",
  "Academic English": "education.research_and_writing.academic_arguments",
  "Specialized Fluency": "education.research_and_writing.finding_sources",
};

const DOMAIN_LEGACY_CATEGORIES: Record<string, string> = {
  everyday_life: "Daily Life",
  home: "Home Life",
  relationships: "Family & Relationships",
  communication: "Social Skills",
  work: "Work & Business",
  education: "School & Learning",
  travel: "Travel & Transport",
  transport: "Travel & Transport",
  shopping_money: "Shopping & Money",
  food: "Food & Drink",
  health: "Health & Body",
  technology_media: "Technology & Media",
  culture_entertainment: "Culture & Entertainment",
  society_nature: "Community & Society",
  personal_growth: "Personal Growth",
};

export function legacyBroadCategoryForDomain(
  domainKey?: string,
): string | undefined {
  return domainKey ? DOMAIN_LEGACY_CATEGORIES[domainKey] : undefined;
}

export function taxonomyPathForCategoryKey(
  categoryKey: string,
): TaxonomyPath | null {
  const category = CATEGORY_BY_KEY.get(categoryKey);
  if (!category) return null;
  const group = GROUP_BY_KEY.get(category.usageGroupKey);
  const domain = DOMAIN_BY_KEY.get(category.domainKey);
  if (!group || !domain) return null;
  return {
    taxonomyVersion: TAXONOMY_VERSION,
    domainKey: domain.key,
    domainName: domain.name,
    usageGroupKey: group.key,
    usageGroupName: group.name,
    categoryKey: category.key,
    categoryName: category.name,
  };
}

export function isValidTaxonomyPath(input: {
  taxonomyVersion?: string;
  domainKey?: string;
  usageGroupKey?: string;
  categoryKey?: string;
}): boolean {
  const path = input.categoryKey
    ? taxonomyPathForCategoryKey(input.categoryKey)
    : null;
  return Boolean(
    path &&
      input.taxonomyVersion === TAXONOMY_VERSION &&
      input.domainKey === path.domainKey &&
      input.usageGroupKey === path.usageGroupKey,
  );
}

export function legacyTaxonomyPath(categoryName?: string): TaxonomyPath {
  const categoryKey =
    (categoryName && LEGACY_CATEGORY_FALLBACKS[categoryName]) ||
    DEFAULT_TAXONOMY_CATEGORY_KEY;
  const path = taxonomyPathForCategoryKey(categoryKey);
  if (!path) throw new Error(`Unknown taxonomy fallback: ${categoryKey}`);
  return path;
}

export function assertTaxonomyCatalogue(): void {
  if (TAXONOMY_DOMAINS.length !== 15)
    throw new Error("Taxonomy must contain 15 domains.");
  if (TAXONOMY_USAGE_GROUPS.length !== 60)
    throw new Error("Taxonomy must contain 60 usage groups.");
  if (TAXONOMY_SPECIFIC_CATEGORIES.length !== 300) {
    throw new Error("Taxonomy must contain 300 specific categories.");
  }
  const keys = new Set(
    TAXONOMY_SPECIFIC_CATEGORIES.map((category) => category.key),
  );
  if (keys.size !== TAXONOMY_SPECIFIC_CATEGORIES.length) {
    throw new Error("Taxonomy category keys must be unique.");
  }
  for (const category of TAXONOMY_SPECIFIC_CATEGORIES) {
    if (!taxonomyPathForCategoryKey(category.key)) {
      throw new Error(`Broken taxonomy path: ${category.key}`);
    }
  }
}

assertTaxonomyCatalogue();
