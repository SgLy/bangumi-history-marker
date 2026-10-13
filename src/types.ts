export interface SubjectImages {
  common: string;
  small?: string;
  grid?: string;
  large?: string;
  medium?: string;
}

export interface SubjectRating {
  rank?: number;
  total?: number;
  score: number;
}

export interface SubjectCollection {
  wish: number;
  collect: number;
  doing: number;
  on_hold: number;
  dropped: number;
}

export interface SubjectLite {
  id: number;
  name: string;
  name_cn: string;
  images: SubjectImages;
}

export interface SubjectRef {
  id: number;
  name: string;
  name_cn: string;
}

export interface SelectedItem {
  subject: SubjectRef;
  originSubjectId?: number;
}

export interface Subject extends SubjectLite {
  date: string | null;
  platform: string;
  rating: SubjectRating;
  collection: SubjectCollection;
  eps: number;
}

export interface RelatedSubject {
  id: number;
  name: string;
  name_cn: string;
  images?: SubjectImages;
  type: number;
  relation: string;
  date: string | null;
}

export type CollectionType = 1 | 2 | 3 | 4 | 5;

export interface UserCollection {
  subject_id: number;
  type: CollectionType;
  private: boolean;
}

export interface Avatar {
  large?: string;
  medium?: string;
  small?: string;
}

export interface Me {
  id: number;
  username: string;
  nickname: string;
  avatar: Avatar;
}

export interface Paged<T> {
  total: number;
  limit: number;
  offset: number;
  data: T[];
}

export type SearchResult = Paged<Subject>;
export type CollectionsResponse = Paged<UserCollection>;
