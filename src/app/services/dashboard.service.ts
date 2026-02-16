import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, from, map, mergeMap, Observable, switchMap, tap, toArray } from 'rxjs';
import { AuthService } from './auth.service';
import { DashboardPage, Group, GroupPage, Models, NewGroup, NewUser, Permission, PermissionType, SelectOption, Title, User } from '../app.types';
import { Router } from '@angular/router';
import { checkEmailValidity, scrollToElement } from '../utils/utils';
import { inlineErrors } from '../app.config';
import { UiService } from './ui.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private http = inject(HttpClient);
  private authSvc = inject(AuthService);
  private uiSvc = inject(UiService);
  private router = inject(Router);

  dashboardPage = signal<DashboardPage>('groups');
  errors = inlineErrors;

  // Groups
  groups = signal<Group[]>([]);
  // groups = computed(() => this.myGroups().filter(g => g.permissions.includes('upload')));
  displayedGroups = signal<Group[]>([]);
  searchGroups = signal<string>('');
  selectedGroupDetail = signal<Group | null>(null);
  selectedGroupPage = signal<GroupPage | null>(null);
  newGroupName = signal<string>('');
  newGroupDescription = signal<string>('');
  newGroupNameError = signal<string>('');
  groupName = signal<string>('');
  groupDescription = signal<string>('');
  groupNameError = signal<string>('');
  groupChanged = computed<boolean>(() => {
    const group = this.selectedGroupDetail();
    if (!group) return false;

    const nameChanged = group.name !== this.groupName();
    const descriptionChanged = group.description !== this.groupDescription();

    return nameChanged || descriptionChanged;
  });

  // Titles
  titles = signal<Title[]>([]);
  displayedTitles = signal<Title[]>([]);
  searchTitles = signal<string>('');
  selectedTitle = signal<Title | null>(null);
  newTitleName = signal<string>('');
  newTitleNameError = signal<string>('');
  availableModels = signal<SelectOption[]>([]);
  selectedModelId = signal<number>(0);
  selectedModel = computed<string>(() => this.availableModels()[this.selectedModelId()].label);
  selectedModelUsed = signal<boolean>(false);
  files = signal<File[]>([]);
  uploadFilesError = signal<string>('');

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
  userPermissions = signal<Permission[]>([]);
  availableGroups = signal<SelectOption[]>([]);
  selectedGroupId = signal<string>('');
  selectedGroupUsed = signal<boolean>(false);
  userNameError = signal<string>('');
  userEmailError = signal<string>('');
  selectedGroupError = signal<string>('');
  groupPermissionsError: Record<string, string> = {};
  userChanged = computed<boolean>(() => {
    const user = this.selectedUser();
    if (!user) return false;

    const fullnameChanged = user.full_name !== this.userFullname();
    const emailChanged = user.email !== this.userEmail();
    const permissionsChanged = user.permissions !== this.userPermissions();

    return fullnameChanged || emailChanged || permissionsChanged;
  });


  /* ------------------------------
    API
  ------------------------------ */
  // Groups
  fetchGroups(): Observable<Group[]> {
    return this.http.get<Group[]>(`${this.authSvc.apiUrl}/groups`, { headers: this.authSvc.authHeaders() });
  }

  createGroup(): Observable<NewGroup> {
    const payload = {
      name: this.newGroupName(),
      description: this.newGroupDescription(),
      default_model: this.selectedModel()
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

  // Titles
  fetchTitles(groupId: string): Observable<GroupPage> {
    return this.http.get<GroupPage>(`${this.authSvc.apiUrl}/groups/${groupId}`, { headers: this.authSvc.authHeaders() });
  }

  fetchModels(): Observable<Models> {
    return this.http.get<Models>(`${this.authSvc.apiUrl}/models`, { headers: this.authSvc.authHeaders() });
  }

  createTitle(groupId: string): Observable<{ id: string }> {
    const payload = {
      external_id: this.newTitleName(),
      model: this.selectedModel()
    };
    return this.http.post<{ id: string }>(`${this.authSvc.apiUrl}/create?group_id=${groupId}`, payload, { headers: this.authSvc.authHeaders('json', true) });
  }

  uploadScan(titleId: string, file: File): Observable<void> {
    const form = new FormData();
    form.append('scan_data', file, file.name);
    return this.http.post<void>(`${this.authSvc.apiUrl}/${titleId}/upload-scan`, form, { headers: this.authSvc.authHeaders() });
  }

  uploadAllScans(titleId: string, files: File[], concurrency: number = 5): Observable<string> {
    return from(files).pipe(
      mergeMap(file => this.uploadScan(titleId, file), concurrency),
      toArray(), // collects all emitted values, and emits one single array
      map(() => titleId)
    );
  }

  processTitle(titleId: string): Observable<void> {
    return this.http.post<void>(`${this.authSvc.apiUrl}/${titleId}/process`, {}, { headers: this.authSvc.authHeaders() });
  }

  deleteTitle(titleId: string): Observable<void> {
    return this.http.delete<void>(`${this.authSvc.apiUrl}/${titleId}`, { headers: this.authSvc.authHeaders() });
  }

  // Users
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
      email: this.userEmail(),
      permissions: this.userPermissions()
    };

    return this.http.patch<User>(`${this.authSvc.apiUrl}/users/${userId}`, payload, { headers: this.authSvc.authHeaders('json', true) });
  }


  /* ------------------------------
    DASHBOARD PAGES
  ------------------------------ */
  navigateToGroups(): void {
    this.closeDrawer();
    this.dashboardPage.set('groups');
    this.router.navigate(['/groups']);
  }

  openGroupsTitles(groupId: string): void {
    this.closeDrawer();
    this.dashboardPage.set('titles');
    this.router.navigate(['/group', groupId]);
  }

  openTitle(bookId: string): void {
    window.location.href = `${this.authSvc.baseUri}/book/${bookId}`;
  }

  navigateToUsers(): void {
    this.closeDrawer();
    this.dashboardPage.set('users');
    this.router.navigate(['/users']);
  }


  /* ------------------------------
    DIALOGS
  ------------------------------ */
  // Group
  createGroupDialog(): void {
    const uiSvc = this.uiSvc;
    
    uiSvc.dialogTitle.set('Nová skupina');
    uiSvc.dialogContent.set(true);
    uiSvc.dialogContentType.set('new-group');
    uiSvc.dialogButtons.set([
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

          uiSvc.closeDialog();
          
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

              this.groups.update(prev => [ ...prev, newGroup ]);
              this.displayedGroups.set(this.groups());
              this.selectedGroupDetail.set(newGroup);
              this.newGroupName.set('');
              this.newGroupDescription.set('');
              this.newGroupNameError.set('');
            }),
            catchError(err => {
              this.uiSvc.showToast('Při vytváření skupiny se něco pokazilo. Zkuste to znovu.', { type: 'error' });
              console.error(err);
              throw err;
            })
          ).subscribe(() => this.openGroupDetail(this.selectedGroupDetail()))
        }
      }
    ]);

    this.fetchModels().pipe(
      catchError(err => {
        this.uiSvc.showToast('Nepodařilo se načíst dostupné AI modely. Zkuste to dialogové okno zavřít a znovu otevřít.', { type: 'error' });
        console.error(err);
        throw err;
      })
    ).subscribe((res: Models) => {
      this.newGroupName.set('');
      this.newGroupDescription.set('');
      this.newGroupNameError.set('');
      this.availableModels.set(res.available_models.map((m, index) => ({ value: index, label: m })));
      this.selectedModelId.set(this.availableModels().length - 1);
      this.selectedModelUsed.set(false);
      this.closeDrawer();
      uiSvc.openDialog();
    });
  }

  deleteGroupDialog(group: Group | null): void {
    const uiSvc = this.uiSvc;
    
    uiSvc.dialogTitle.set('Smazat skupinu');
    uiSvc.dialogDescription.set(`Opravdu chcete smazat skupinu${' ' + group?.name}?`);
    uiSvc.dialogContent.set(false);
    uiSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Smazat skupinu',
        primary: true,
        destructive: true,
        action: () => this.deleteGroup(group?._id ?? '').pipe(
          tap(() => {
            const updated = this.groups().filter(g => g._id !== group?._id);
            this.groups.set(updated);
            this.displayedGroups.set(updated);
            this.selectedGroupDetail.set(null);
            uiSvc.closeDialog();
          }),
          catchError(err => {
            this.uiSvc.showToast('Při mazání skupiny se něco pokazilo. Zkuste to znovu.', { type: 'error' });
            console.error(err);
            throw err;
          })
        ).subscribe(() => this.closeDrawer())
      }
    ])

    uiSvc.openDialog();
  }

  // Title
  createTitleDialog(): void {
    const uiSvc = this.uiSvc;
    this.files.set([]);
    
    uiSvc.dialogTitle.set('Nová kniha');
    uiSvc.dialogContent.set(true);
    uiSvc.dialogContentType.set('new-title');
    uiSvc.dialogButtons.set([
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

          if (!this.files().length) {
            this.uploadFilesError.set(this.errors['filesEmpty']);
            return;
          }

          uiSvc.closeDialog();
          
          return this.createTitle(this.selectedGroupPage()?._id ?? '').pipe(
            map(res => {
              const now = Date();
              const newTitle: Title = {
                _id: res.id,
                external_id: newTitleName,
                model: this.selectedModel(),
                created_at: now,
                modified_at: now,
                state: 'scheduled'
              };

              this.titles.update(prev => [ newTitle, ...prev ]);
              this.displayedTitles.set(this.titles());

              return res.id;
            }),
            switchMap(id => this.uploadAllScans(id, this.files())),
            switchMap(id => this.processTitle(id)),
            catchError(err => {
              this.uiSvc.showToast(`Při nahrávání skenů se něco pokazilo. Knihu smažte a přidejte ji jako novou.`, { type: 'error' });
              console.error(err);
              throw err;
            })
          ).subscribe();
        }
      }
    ]);

    this.fetchModels().pipe(
      catchError(err => {
        this.uiSvc.showToast('Nepodařilo se načíst dostupné AI modely. Zkuste to dialogové okno zavřít a znovu otevřít.', { type: 'error' });
        console.error(err);
        throw err;
      })
    ).subscribe((res: Models) => {
      this.newTitleName.set('');
      this.newTitleNameError.set('');
      this.uploadFilesError.set('');
      this.availableModels.set(res.available_models.map((m, index) => ({ value: index, label: m })));
      this.selectedModelId.set(this.availableModels().length - 1);
      this.selectedModelUsed.set(false);
      this.closeDrawer();
      uiSvc.openDialog();
    });
  }

  onSelectModelUsed(used: boolean): void {
    this.selectedModelUsed.set(used);
  }

  uploadFiles(files: FileList) {
    this.files.update(prev => [ ...prev, ...Array.from(files) ]);
  }

  deleteTitleDialog(title: Title | null): void {
    const uiSvc = this.uiSvc;
    
    uiSvc.dialogTitle.set('Smazat knihu');
    uiSvc.dialogDescription.set(`Opravdu chcete smazat knihu${' ' + title?.external_id}?`);
    uiSvc.dialogContent.set(false);
    uiSvc.dialogButtons.set([
      { label: 'Zrušit' },
      {
        label: 'Smazat knihu',
        primary: true,
        destructive: true,
        action: () => this.deleteTitle(title?._id ?? '').pipe(
          tap(() => {
            this.titles.update(prev => prev.filter(t => t._id !== (title?._id ?? '')));
            this.displayedTitles.set(this.titles());
            this.selectedTitle.set(null);
            uiSvc.closeDialog();
          }),
          catchError(err => {
            this.uiSvc.showToast('Nepodařilo se smazat knihu. Zkuste to znovu.', { type: 'error' })
            console.error(err);
            throw err;
          })
        ).subscribe(() => this.closeDrawer())
      }
    ])

    uiSvc.openDialog();
  }

  // User
  createUserDialog(): void {
    const uiSvc = this.uiSvc;
    
    uiSvc.dialogTitle.set('Nový uživatel');
    uiSvc.dialogContent.set(true);
    uiSvc.dialogContentType.set('new-user');
    uiSvc.dialogButtons.set([
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
          
          uiSvc.closeDialog();

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
              this.uiSvc.showToast('Nepodařilo se vytvořit uživatele. Zkuste to znovu.', { type: 'error' });
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
    uiSvc.openDialog();
  }

  deleteUserDialog(user: User | null): void {
    const uiSvc = this.uiSvc;
    
    uiSvc.dialogTitle.set('Smazat uživatele');
    uiSvc.dialogDescription.set(`Opravdu chcete smazat uživatele${' ' + user?.full_name}?`);
    uiSvc.dialogContent.set(false);
    uiSvc.dialogButtons.set([
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
            uiSvc.closeDialog();
          }),
          catchError(err => {
            this.uiSvc.showToast('Nepodařilo se smazat uživatele. Zkuste to znovu.', { type: 'error' });
            console.error(err);
            throw err;
          })
        ).subscribe(() => this.closeDrawer())
      }
    ])

    uiSvc.openDialog();
  }


  /* ------------------------------
    DRAWER ACTIONS
  ------------------------------ */
  closeDrawer(): void {
    this.uiSvc.closeDrawer();
    
    switch (this.dashboardPage()) {
      case 'groups':
        this.selectedGroupDetail.set(null);
        break;
      case 'titles':
        this.selectedTitle.set(null);
        break;
      case 'users':
        this.selectedUser.set(null);
        break;
      default:
        break;
    }
  }

  // Group
  openGroupDetail(group: Group | null): void {
    const uiSvc = this.uiSvc;
    if (!group) return;
    
    this.selectedGroupDetail.set(group);
    uiSvc.drawerTitle.set(group.name);
    uiSvc.drawerContent.set(true);
    uiSvc.drawerContentType.set('groups');
    this.groupName.set(group.name);
    this.groupNameError.set('');
    this.groupDescription.set(group.description);
    
    if (this.authSvc.user()?.role === 'admin') {
      uiSvc.drawerButtons.set([
        {
          label: 'Zavřít',
          action: () => this.closeDrawer()
        },
        {
          label: 'Uložit změny',
          primary: true,
          action: () => {
            if (!this.groupChanged()) return;
            if (!uiSvc.drawerEditMode()) return;
            const group = this.selectedGroupDetail();
            if (!group) return;

            const groupName = this.groupName();

            if (!groupName) {
              this.groupNameError.set(this.errors['groupNameEmpty']);
              scrollToElement(document.getElementById('new-group-name') as HTMLElement);
              return;
            }

            if (this.groups().filter(g => g !== group).some(g => g.name === groupName)) {
              this.groupNameError.set(this.errors['groupNameExists']);
              scrollToElement(document.getElementById('new-group-name') as HTMLElement);
              return;
            }

            return this.updateGroup(group?._id ?? '').pipe(
              tap(() => {
                this.groups.update(prev => prev.map(g => g._id === group?._id ? {
                  ...group,
                  name: this.groupName(),
                  description: this.groupDescription()
                } : g))
                this.displayedGroups.set(this.groups());
                this.selectedGroupDetail.set(null);
                this.groupNameError.set('');
              }),
              catchError(err => {
                this.uiSvc.showToast('Nepodařilo se uložit změny. Zkuste to znovu.', { type: 'error' });
                console.error(err);
                throw err;
              })
            ).subscribe(() => this.closeDrawer());
          }
        }
      ]);
    }

    uiSvc.openDrawer();
  }

  // Title
  openTitleDetail(title: Title | null): void {
    if (!title) return;
    const uiSvc = this.uiSvc;
    
    this.selectedTitle.set(title);
    this.files.set([]);
    uiSvc.drawerTitle.set(title?.external_id ?? 'Bez názvu');
    uiSvc.drawerContent.set(true);
    uiSvc.drawerContentType.set('titles');
    uiSvc.drawerButtons.set([]);

    uiSvc.openDrawer();
  }

  applyAiModel(title: Title | null): void {
    this.processTitle(title?._id ?? '').pipe(
      catchError(err => {
        this.uiSvc.showToast('Něco se pokazilo při aplikaci AI modelu. Zkuste to znovu.', { type: 'error' })
        console.error(err);
        throw err;
      })
    ).subscribe(() => {
      const selectedTitle = this.selectedTitle();
      if (!selectedTitle) return;

      const updatedTitle: Title = {
        ...selectedTitle,
        state: 'ready'
      };
      this.titles.update( prev => prev.map(t => t._id === selectedTitle?._id ? updatedTitle : t));
      this.displayedTitles.set(this.titles());
      this.selectedTitle.set(updatedTitle);
      this.uiSvc.showToast(`AI model byl úspěšně aplikován na knihu ${selectedTitle.external_id}!`, { type: 'success' });
    });
  }

  // User
  openUserDetail(user: User | null): void {
    if (!user) return;
    const uiSvc = this.uiSvc;
    
    this.userNameError.set('');
    this.userEmailError.set('');
    this.selectedGroupError.set('');
    this.groupPermissionsError = {};

    this.selectedUser.set(user);
    this.selectedGroupId.set('');
    this.userPermissions.set(user.permissions);

    this.fetchGroups().pipe(
      catchError(err => {
        this.uiSvc.showToast('Při načítání skupin se něco pokazilo. Zkuste stránku znovu načíst.', { type: 'error' });
        console.error('Fetching groups failed:', err);
        throw err;
      })
    ).subscribe((res: Group[]) => {
      this.groups.set(res);
      this.availableGroups.set(res
        .filter(g => !user.permissions.map(p => p.group_id).includes(g._id))
        .map(g => ({ value: g._id, label: g.name })))
    });

    uiSvc.drawerTitle.set(user.full_name);
    uiSvc.drawerContent.set(true);
    uiSvc.drawerContentType.set('users');
    this.userFullname.set(user.full_name);
    this.userEmail.set(user.email);
    
    uiSvc.drawerButtons.set([
      {
        label: 'Zavřít',
        action: () => this.closeDrawer()
      },
      {
        label: 'Uložit změny',
        primary: true,
        action: () => {
          if (!this.userChanged()) return;
          if (!uiSvc.drawerEditMode()) return;

          const userName = this.userFullname();
          const userEmail = this.userEmail();

          if (!userName) {
            this.userNameError.set(this.errors['userNameEmpty']);
            scrollToElement(document.getElementById('user-fullname') as HTMLElement);
            return;
          }

          if (!userEmail) {
            this.userEmailError.set(this.errors['userEmailEmpty']);
            scrollToElement(document.getElementById('user-email') as HTMLElement);
            return;
          }

          if (!checkEmailValidity(this.userEmail())) {
            this.userEmailError.set(this.errors['userEmailInvalid']);
            scrollToElement(document.getElementById('user-email') as HTMLElement);
            return;
          }

          if (this.users().filter(u => u._id !== this.selectedUser()?._id).some(u => u.email === userEmail)) {
            this.userEmailError.set(this.errors['userEmailExists']);
            scrollToElement(document.getElementById('user-email') as HTMLElement);
            return;
          }

          const emptyGroups = this.userPermissions().filter(g => !g.permission.length);
          if (emptyGroups.length) {
            this.groupPermissionsError[emptyGroups[0].group_id] = this.errors['groupPermissionsEmpty'];
            scrollToElement(document.getElementById(`permissions-row-${emptyGroups[0].group_id}`) as HTMLElement);
            return;
          }

          return this.updateUser(this.selectedUser()?._id ?? '').pipe(
            tap((res: User) => {
              this.users.update(prev => prev.map(u => u._id === res._id ? res : u));
              this.displayedUsers.set(this.users());
              this.selectedUser.set(null);
            }),
            catchError(err => {
              this.uiSvc.showToast('Nepodařilo se uložit změny. Zkuste to znovu.', { type: 'error' });
              console.error(err);
              throw err;
            })
          ).subscribe(() => this.closeDrawer());
        }
      }
    ]);

    uiSvc.openDrawer();
  }

  removeFromAllGroups(): void {
    this.userPermissions.set([]);
    this.availableGroups.set(this.groups().map(g => ({ value: g._id, label: g.name })));
  }

  removeFromGroup(groupId: string): void {
    this.userPermissions.update(prev => prev.filter(p => p.group_id !== groupId));
    this.availableGroups.update(prev => 
      this.groups()
        .filter(g => prev.map(p => p.value).includes(g._id) || g._id === groupId)
        .map(g => ({ value: g._id, label: g.name }))
    );
    this.groupPermissionsError[groupId] = '';
  }

  onSelectGroupUsed(used: boolean): void {
    this.selectedGroupUsed.set(used);
  }

  addUserToGroup(groupId: string): void {
    if (!this.selectedGroupId()) {
      this.selectedGroupError.set(this.errors['selectedGroupEmpty']);
      return;
    }
    
    this.userPermissions.update(prev => [
      {
        group_id: groupId,
        group_name: this.availableGroups().find(g => g.value === groupId)?.label ?? '',
        permission: []
      },
      ...prev
    ]);
    this.availableGroups.update(prev => prev.filter(option => option.value !== groupId));
    this.selectedGroupId.set('');
    this.selectedGroupError.set('');
  }

  togglePermission(groupId: string, permissionType: PermissionType): void {
    this.userPermissions.update(prev => prev.map(g => g.group_id === groupId
      ? {
        ...g,
        permission: g.permission.includes(permissionType)
          ? g.permission.filter(p => p !== permissionType)
          : [ ...g.permission, permissionType ]
      }
      : g));
    this.groupPermissionsError[groupId] = '';
  }


  /* ------------------------------
    INPUT INLINE VALIDATION
  ------------------------------ */
  // Group
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
        .filter(g => g._id !== this.selectedGroupDetail()?._id)
        .some(g => g.name === this.groupName())
          ? this.errors['groupNameExists']
          : ''
    );
  }

  // Title
  checkNewTitleName(): void {
    this.newTitleNameError.set('');
  }

  // User
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