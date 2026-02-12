import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, Observable, tap } from 'rxjs';
import { AuthService } from './auth.service';
import { DashboardPage, DrawerButton, DrawerContentType, Group, GroupDetail, Models, NewGroup, NewUser, Permission, PermissionType, Title, User } from '../app.types';
import { Router } from '@angular/router';
import { EditorService } from './editor.service';
import { checkEmailValidity } from '../utils/utils';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private authSvc = inject(AuthService);
  private edtSvc = inject(EditorService);
  private router = inject(Router);

  dashboardPage = signal<DashboardPage>('my-groups');
  errors: Record<string, string> = {
    groupNameEmpty: 'Zadejte název skupiny.',
    groupNameExists: 'Skupina s daným názvem už existuje. Zadejte prosím jiný název.',
    titleNameEmpty: 'Zadejte název knihy.',
    userNameEmpty: 'Zadejte jméno uživatele.',
    userEmailEmpty: 'Zadejte e-mail uživatele.',
    userEmailInvalid: 'Zadejte e-mail uživatele ve formátu uzivatel@domena.cz.',
    userEmailExists: 'Uživatel s daným e-mailem už existuje. Zadejte prosím jiný e-mail.'
  };

  // My groups
  myGroups = signal<Group[]>([]);
  displayedMyGroups = signal<Group[]>([]);
  searchMyGroups = signal<string>('');
  selectedMyGroup = signal<GroupDetail | null>(null);
  titles = signal<Title[]>([]);
  displayedTitles = signal<Title[]>([]);
  searchTitles = signal<string>('');

  // Groups
  groups = computed(() => this.myGroups().filter(g => g.permissions.includes('upload')));
  displayedGroups = signal<Group[]>([]);
  searchGroups = signal<string>('');
  selectedGroup = signal<Group | null>(null);
  newGroupName = signal<string>('');
  newGroupDescription = signal<string>('');
  newGroupNameError = signal<string>('');
  groupName = signal<string>('');
  groupDescription = signal<string>('');
  groupNameError = signal<string>('');
  groupChanged = computed<boolean>(() => {
    const group = this.selectedGroup();
    if (!group) return false;

    const nameChanged = group.name !== this.groupName();
    const descriptionChanged = group.description !== this.groupDescription();

    return nameChanged || descriptionChanged;
  });
  newTitleName = signal<string>('');
  newTitleNameError = signal<string>('');
  availableModels = signal<{ value: number, label: string }[]>([]);
  selectedModelId = signal<number>(0);
  selectedModel = computed<string>(() => this.availableModels()[this.selectedModelId()].label);
  selectedModelUsed = signal<boolean>(false);

  // Users
  users = signal<User[]>([]);
  displayedUsers = signal<User[]>([]);
  searchUsers = signal<string>('');
  selectedUser = signal<User | null>(null);
  newUserEmail = signal<string>('');
  newUserFullname = signal<string>('');
  newUserPermissions = signal<Permission[]>([]);
  newUserNameError = signal<string>('');
  newUserEmailError = signal<string>('');
  userFullname = signal<string>('');
  userEmail = signal<string>('');
  userNameError = signal<string>('');
  userEmailError = signal<string>('');
  userChanged = computed<boolean>(() => {
    const user = this.selectedUser();
    if (!user) return false;

    const fullnameChanged = user.full_name !== this.userFullname();
    const emailChanged = user.email !== this.userEmail();

    return fullnameChanged || emailChanged;
  });


  /* ------------------------------
    API
  ------------------------------ */
  fetchGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.authSvc.apiUrl}/groups`, { headers: this.authSvc.authHeaders() });
  }

  fetchTitles(groupId: string): Observable<GroupDetail> {
    return this.http.get<GroupDetail>(`${this.authSvc.apiUrl}/groups/${groupId}`, { headers: this.authSvc.authHeaders() });
  }

  fetchModels(): Observable<Models> {
    return this.http.get<Models>(`${this.authSvc.apiUrl}/models`, { headers: this.authSvc.authHeaders() });
  }

  createGroup(): Observable<NewGroup> {
    const payload = {
      name: this.newGroupName(),
      description: this.newGroupDescription()
    };
    return this.http.post<NewGroup>(`${this.authSvc.apiUrl}/groups`, payload, { headers: this.authSvc.authHeaders('json', true) });
  }

  deleteGroup(groupId: string): Observable<void> {
    return this.http.delete<void>(`${this.authSvc.apiUrl}/groups/${groupId}`, { headers: this.authSvc.authHeaders() });
  }

  updateGroup(groupId: string): Observable<void> {
    const payload = {
      name: this.groupName(),
      description: this.groupDescription()
    };

    return this.http.patch<void>(`${this.authSvc.apiUrl}/groups/${groupId}`, payload, { headers: this.authSvc.authHeaders('json', true) });
  }

  fetchUsers(groupId?: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.authSvc.apiUrl}/users${groupId ? `?group_id=${groupId}` : ''}`, { headers: this.authSvc.authHeaders() });
  }

  createUser(): Observable<NewUser> {
    const permissions = this.newUserPermissions();
    const payload = {
      email: this.newUserEmail(),
      full_name: this.newUserFullname(),
      ...(permissions && { permissions: permissions })
    };

    return this.http.post<NewUser>(`${this.authSvc.apiUrl}/users/register`, payload, { headers: this.authSvc.authHeaders('json', true) });
  }

  deleteUser(userId: string): Observable<void> {
    return this.http.delete<void>(`${this.authSvc.apiUrl}/users/${userId}`, { headers: this.authSvc.authHeaders() });
  }

  updateUser(userId: string): Observable<User> {
    const payload = {
      full_name: this.userFullname(),
      email: this.userEmail()
    };

    return this.http.patch<User>(`${this.authSvc.apiUrl}/users/${userId}`, payload, { headers: this.authSvc.authHeaders('json', true) });
  }


  /* ------------------------------
    DASHBOARD PAGES
  ------------------------------ */
  navigateToMyGroups(): void {
    this.closeDrawer();
    this.dashboardPage.set('my-groups');
    this.router.navigate(['/']);
  }
  
  openMyGroupsTitles(groupId: string): void {
    this.dashboardPage.set('my-groups-titles');
    this.router.navigate(['/group', groupId]);
  }

  openTitle(bookId: string): void {
    window.location.href = `${this.authSvc.baseUri}/book/${bookId}`;
  }

  navigateToGroups(): void {
    this.closeDrawer();
    this.dashboardPage.set('groups');
    this.router.navigate(['/groups']);
  }

  navigateToUsers(): void {
    this.closeDrawer();
    this.dashboardPage.set('users');
    this.router.navigate(['/users']);
  }


  /* ------------------------------
    DIALOGS
  ------------------------------ */
  createGroupDialog(): void {
    const edtSvc = this.edtSvc;
    
    edtSvc.dialogTitle.set('Nová skupina');
    edtSvc.dialogContent.set(true);
    edtSvc.dialogContentType.set('new-group');
    edtSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Vytvořit',
        primary: true,
        action: () => {
          const newGroupName = this.newGroupName();

          if (!newGroupName) {
            this.newGroupNameError.set(this.errors['groupNameEmpty']);
            return;
          }

          if (this.groups().some(g => g.name === newGroupName)) {
            this.newGroupNameError.set(this.errors['groupNameExists']);
            return;
          }

          this.edtSvc.closeDialog();
          
          return this.createGroup().pipe(
            tap((res: NewGroup) => {
              const now = Date();
              const user = this.authSvc.user();
              const permissions = ['read_group', 'read_title', 'write', 'upload'] as PermissionType[];
              const newGroup = {
                _id: res.id,
                name: newGroupName,
                api_key: {
                  key: res?.api_key ?? '',
                  created_at: now  
                },
                description: this.newGroupDescription(),
                created_at: now,
                modified_at: now,
                title_count: 0,
                permissions: permissions,
                users: [{
                  _id: user?._id ?? '',
                  full_name: user?.full_name ?? '',
                  permission: permissions
                }]
              };

              this.myGroups.update(prev => [ ...prev, newGroup ]);
              this.displayedGroups.set(this.myGroups());
              this.selectedGroup.set(newGroup);
              this.newGroupName.set('');
              this.newGroupDescription.set('');
              this.newGroupNameError.set('');
            }),
            catchError(err => {
              console.error(err);
              throw err;
            })
          ).subscribe(() => this.openGroupDetail(this.selectedGroup()))
        }
      }
    ])

    this.newGroupName.set('');
    this.newGroupDescription.set('');
    this.newGroupNameError.set('');
    this.closeDrawer();
    edtSvc.openDialog();
  }

  deleteGroupDialog(group: Group | null): void {
    const edtSvc = this.edtSvc;
    
    edtSvc.dialogTitle.set('Smazat skupinu');
    edtSvc.dialogDescription.set(`Opravdu chcete smazat skupinu${' ' + group?.name}?`);
    edtSvc.dialogContent.set(false);
    edtSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Smazat skupinu',
        primary: true,
        destructive: true,
        action: () => this.deleteGroup(group?._id ?? '').pipe(
          tap(() => {
            const updated = this.myGroups().filter(g => g._id !== group?._id);
            this.myGroups.set(updated);
            this.displayedGroups.set(updated);
            this.selectedGroup.set(null);
            this.edtSvc.closeDialog();
          }),
          catchError(err => {
            console.error(err);
            throw err;
          })
        ).subscribe(() => this.closeDrawer())
      }
    ])

    edtSvc.openDialog();
  }

  createTitleDialog(): void {
    const edtSvc = this.edtSvc;
    
    edtSvc.dialogTitle.set('Nová kniha');
    edtSvc.dialogContent.set(true);
    edtSvc.dialogContentType.set('new-title');
    edtSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Vytvořit',
        primary: true,
        action: () => {
          const newTitleName = this.newTitleName();

          if (!newTitleName) {
            this.newTitleNameError.set(this.errors['titleNameEmpty']);
            return;
          }

          this.edtSvc.closeDialog();
          
          return this.createGroup().pipe(
            tap((res: NewGroup) => {
              const now = Date();
              const user = this.authSvc.user();
              const permissions = ['read_group', 'read_title', 'write', 'upload'] as PermissionType[];
              const newGroup = {
                _id: res.id,
                name: newTitleName,
                api_key: {
                  key: res?.api_key ?? '',
                  created_at: now  
                },
                description: this.newGroupDescription(),
                created_at: now,
                modified_at: now,
                title_count: 0,
                permissions: permissions,
                users: [{
                  _id: user?._id ?? '',
                  full_name: user?.full_name ?? '',
                  permission: permissions
                }]
              };

              this.myGroups.update(prev => [ ...prev, newGroup ]);
              this.displayedGroups.set(this.myGroups());
              this.selectedGroup.set(newGroup);
              this.newGroupName.set('');
              this.newGroupDescription.set('');
              this.newGroupNameError.set('');
            }),
            catchError(err => {
              console.error(err);
              throw err;
            })
          ).subscribe(() => this.openGroupDetail(this.selectedGroup()))
        }
      }
    ])

    this.fetchModels().pipe(
      catchError(err => {
        console.error(err);
        throw err;
      })
    ).subscribe((res: Models) => {
      this.newTitleName.set('');
      this.newTitleNameError.set('');
      this.availableModels.set(res.available_models.map((m, index) => ({ value: index, label: m })));
      this.selectedModelId.set(this.availableModels().length - 1);
      this.selectedModelUsed.set(false);
      this.closeDrawer();
      edtSvc.openDialog();
    });
  }

  onSelectModelUsed(used: boolean): void {
    this.selectedModelUsed.set(used);
  }

  createUserDialog(): void {
    const edtSvc = this.edtSvc;
    
    edtSvc.dialogTitle.set('Nový uživatel');
    edtSvc.dialogContent.set(true);
    edtSvc.dialogContentType.set('new-user');
    edtSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Vytvořit',
        primary: true,
        action: () => {
          if (!this.newUserFullname()) {
            this.newUserNameError.set(this.errors['userNameEmpty']);
          }

          const newUserEmail = this.newUserEmail();

          if (!newUserEmail) {
            this.newUserEmailError.set(this.errors['userEmailEmpty']);
            return;
          }

          if (!checkEmailValidity(newUserEmail)) {
            this.newUserEmailError.set(this.errors['userEmailInvalid']);
            return;
          }

          if (this.users().some(u => u.email === this.newUserEmail())) {
            this.newUserEmailError.set(this.errors['userEmailExists']);
            return;
          }
          
          this.edtSvc.closeDialog();

          return this.createUser().pipe(
            tap((res: NewUser) => {
              const newUser: User = {
                _id: res.id,
                email: this.newUserEmail(),
                full_name: this.newUserFullname(),
                password: res.password,
                role: 'user',
                permissions: this.newUserPermissions()
              };

              this.users.update(prev => [ ...prev, newUser ]);
              this.displayedUsers.set(this.users());
              this.selectedUser.set(newUser);
              this.newUserEmail.set('');
              this.newUserFullname.set('');
              this.newUserPermissions.set([]);
              this.newUserNameError.set('');
              this.newUserEmailError.set('');
            }),
            catchError(err => {
              console.error(err);
              throw err;
            })
          ).subscribe(() => this.openUserDetail(this.selectedUser()))
        }
      }
    ])

    this.newUserEmail.set('');
    this.newUserFullname.set('');
    this.newUserPermissions.set([]);
    this.newUserNameError.set('');
    this.newUserEmailError.set('');
    this.closeDrawer();
    edtSvc.openDialog();
  }

  deleteUserDialog(user: User | null): void {
    const edtSvc = this.edtSvc;
    
    edtSvc.dialogTitle.set('Smazat uživatele');
    edtSvc.dialogDescription.set(`Opravdu chcete smazat uživatele${' ' + user?.full_name}?`);
    edtSvc.dialogContent.set(false);
    edtSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Smazat uživatele',
        primary: true,
        destructive: true,
        action: () => this.deleteUser(user?._id ?? '').pipe(
          tap(() => {
            const updated = this.users().filter(u => u._id !== user?._id);
            this.users.set(updated);
            this.displayedUsers.set(updated);
            this.selectedUser.set(null);
            this.edtSvc.closeDialog();
          }),
          catchError(err => {
            console.error(err);
            throw err;
          })
        ).subscribe(() => this.closeDrawer())
      }
    ])

    edtSvc.openDialog();
  }


  /* ------------------------------
    DRAWER ACTIONS
  ------------------------------ */
  drawerOpen = signal<boolean>(false);
  drawerTitle = signal<string>('');
  drawerContent = signal<boolean>(false);
  drawerContentType = signal<DrawerContentType | null>(null);
  drawerDescription = signal<string | null>(null);
  drawerButtons = signal<DrawerButton[]>([]);
  
  openDrawer(): void {
    this.drawerOpen.set(true);
  }

  closeDrawer(): void {
    this.drawerOpen.set(false);

    switch (this.dashboardPage()) {
      case 'groups':
        this.selectedGroup.set(null);
        break;
      case 'users':
        this.selectedUser.set(null);
        break;
      default:
        break;
    }
  }

  openGroupDetail(group: Group | null): void {
    if (!group) return;
    
    this.selectedGroup.set(group);
    this.drawerTitle.set(group.name);
    this.drawerContent.set(true);
    this.drawerContentType.set('groups');
    this.groupName.set(group.name);
    this.groupDescription.set(group.description);
    
    if (this.authSvc.user()?.role === 'admin') {
      this.drawerButtons.set([
        {
          label: 'Zavřít',
          action: () => this.closeDrawer()
        },
        {
          label: 'Uložit změny',
          primary: true,
          action: () => {
            if (!this.groupChanged()) return;
            const group = this.selectedGroup();
            if (!group) return;

            const groupName = this.groupName();

            if (!groupName) {
              this.groupNameError.set(this.errors['groupNameEmpty']);
              return;
            }

            if (this.groups().some(g => g.name === groupName)) {
              this.groupNameError.set(this.errors['groupNameExists']);
              return;
            }

            return this.updateGroup(group?._id ?? '').pipe(
              tap(() => {
                this.myGroups.update(prev => prev.map(g => g._id === group?._id ? {
                  ...group,
                  name: this.groupName(),
                  description: this.groupDescription()
                } : g))
                this.displayedGroups.set(this.groups());
                this.selectedGroup.set(null);
                this.groupNameError.set('');
              }),
              catchError(err => {
                console.error(err);
                throw err;
              })
            ).subscribe(() => this.closeDrawer());
          }
        }
      ]);
    }

    this.openDrawer();
  }

  openUserDetail(user: User | null): void {
    if (!user) return;
    
    this.selectedUser.set(user);
    this.drawerTitle.set(user.full_name);
    this.drawerContent.set(true);
    this.drawerContentType.set('users');
    this.userFullname.set(user.full_name);
    this.userEmail.set(user.email);
    
    this.drawerButtons.set([
      {
        label: 'Zavřít',
        action: () => this.closeDrawer()
      },
      {
        label: 'Uložit změny',
        primary: true,
        action: () => {
          if (!this.userChanged()) return;

          const userName = this.userFullname();
          const userEmail = this.userEmail();

          if (!userName) {
            this.userNameError.set(this.errors['userNameEmpty']);
            return;
          }

          if (!userEmail) {
            this.userEmailError.set(this.errors['userEmailEmpty']);
            return;
          }

          if (!checkEmailValidity(this.userEmail())) {
            this.userEmailError.set(this.errors['userEmailInvalid']);
            return;
          }

          if (this.users().filter(u => u._id !== this.selectedUser()?._id).some(u => u.email === userEmail)) {
            this.userEmailError.set(this.errors['userEmailExists']);
            return;
          }

          return this.updateUser(this.selectedUser()?._id ?? '').pipe(
            tap((res: User) => {
              this.users.update(prev => prev.map(u => u._id === res._id ? res : u));
              this.displayedUsers.set(this.users());
              this.selectedUser.set(null);
            }),
            catchError(err => {
              console.error(err);
              throw err;
            })
          ).subscribe(() => this.closeDrawer());
        }
      }
    ]);

    this.openDrawer();
  }


  /* ------------------------------
    INPUT INLINE VALIDATION
  ------------------------------ */
  checkNewGroupNameUniqueness(): void {
    this.newGroupNameError.set(this.groups()
      .some(g => g.name === this.newGroupName())
        ? this.errors['groupNameExists']
        : ''
    );
  }

  checkGroupNameUniqueness(): void {
    this.groupNameError.set(
      this.groups()
        .filter(g => g._id !== this.selectedGroup()?._id)
        .some(g => g.name === this.groupName())
          ? this.errors['groupNameExists']
          : ''
    );
  }

  checkNewUserName(): void {
    this.newUserNameError.set('');
  }

  checkNewUserEmail(): void {
    this.checkNewUserEmailValidity();
    this.checkNewUserEmailUniqueness();
  }

  private checkNewUserEmailValidity(): void {
    this.newUserEmailError.set(checkEmailValidity(this.newUserEmail())
      ? this.errors['userEmailInvalid']
      : ''
    );
  }

  private checkNewUserEmailUniqueness(): void {
    this.newUserEmailError.set(
      this.users()
        .some(u => u.email === this.newUserEmail())
          ? this.errors['userEmailExists']
          : ''
    );
  }

  checkUserName(): void {
    this.userNameError.set('');
  }

  checkUserEmail(): void {
    this.checkUserEmailValidity();
    this.checkUserEmailUniqueness();
  }

  private checkUserEmailValidity(): void {
    this.userEmailError.set(checkEmailValidity(this.userEmail())
      ? this.errors['userEmailInvalid']
      : ''
    );
  }

  private checkUserEmailUniqueness(): void {
    this.userEmailError.set(
      this.users()
        .filter(u => u._id !== this.selectedUser()?._id)
        .some(u => u.email === this.userEmail())
          ? this.errors['userEmailExists']
          : ''
    );
  }
}