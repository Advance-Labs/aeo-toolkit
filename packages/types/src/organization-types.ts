/**
 * schema.org Organization and the subtypes a site actually marks itself up as.
 *
 * Presence checks used to accept only `Organization` and `LocalBusiness`, so a site marked up as
 * `Corporation`, `NGO` or `Restaurant` failed "Organization schema is present" while carrying
 * exactly that. Shared by schema-validator (presence) and scoring (identity consistency).
 *
 * ponytail: not the full ~250-type tree. Every direct Organization and LocalBusiness subtype is
 * here, plus the common leaf types; add a leaf when a real site trips on it.
 */
export const ORGANIZATION_TYPES: ReadonlySet<string> = new Set([
  'Organization',
  // Direct Organization subtypes (https://schema.org/Organization, "More specific Types").
  'Airline', 'Consortium', 'Cooperative', 'Corporation', 'EducationalOrganization',
  'FundingScheme', 'GovernmentOrganization', 'LibrarySystem', 'LocalBusiness',
  'MedicalOrganization', 'MemberProgram', 'NGO', 'NewsMediaOrganization', 'OnlineBusiness',
  'PerformingGroup', 'PoliticalParty', 'Project', 'ResearchOrganization',
  'SearchRescueOrganization', 'SportsOrganization', 'WorkersUnion',
  // Common deeper Organization types.
  'CollegeOrUniversity', 'School', 'HighSchool', 'MiddleSchool', 'ElementarySchool', 'Preschool',
  'Hospital', 'MedicalClinic', 'Pharmacy', 'Physician', 'DiagnosticLab', 'VeterinaryCare',
  'OnlineStore', 'MusicGroup', 'TheaterGroup', 'DanceGroup', 'SportsTeam', 'ResearchProject',
  'FundingAgency',
  // Direct LocalBusiness subtypes (https://schema.org/LocalBusiness).
  'AnimalShelter', 'ArchiveOrganization', 'AutomotiveBusiness', 'ChildCare', 'Dentist',
  'DryCleaningOrLaundry', 'EmergencyService', 'EmploymentAgency', 'EntertainmentBusiness',
  'FinancialService', 'FoodEstablishment', 'GovernmentOffice', 'HealthAndBeautyBusiness',
  'HomeAndConstructionBusiness', 'InternetCafe', 'LegalService', 'Library', 'LodgingBusiness',
  'MedicalBusiness', 'ProfessionalService', 'RadioStation', 'RealEstateAgent', 'RecyclingCenter',
  'SelfStorage', 'ShoppingCenter', 'SportsActivityLocation', 'Store', 'TelevisionStation',
  'TouristInformationCenter', 'TravelAgency',
  // Common LocalBusiness leaf types.
  'Restaurant', 'CafeOrCoffeeShop', 'Bakery', 'BarOrPub', 'FastFoodRestaurant', 'Hotel',
  'Attorney', 'Notary', 'AccountingService', 'BankOrCreditUnion', 'InsuranceAgency',
  'AutoRepair', 'AutoDealer', 'BeautySalon', 'HairSalon', 'DaySpa', 'HealthClub',
  'Electrician', 'GeneralContractor', 'HVACBusiness', 'HousePainter', 'Locksmith',
  'MovingCompany', 'Plumber', 'RoofingContractor', 'ClothingStore', 'ElectronicsStore',
  'FurnitureStore', 'GroceryStore', 'HardwareStore', 'HomeGoodsStore', 'JewelryStore',
  'Optician', 'PetStore',
]);

/** Whether a short schema.org type (e.g. "Corporation") is Organization or one of its subtypes. */
export function isOrganizationType(shortType: string): boolean {
  return ORGANIZATION_TYPES.has(shortType);
}
