create type user_role as enum ('ATTENDEE', 'ORGANIZER', 'EVENT_ADMIN', 'PLATFORM_ADMIN');
create type ticket_status as enum ('VALID', 'CHECKED_IN', 'CANCELLED', 'REFUNDED');
create type order_status as enum ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
create table users (
    id serial primary key,
    email varchar(255) unique not null,
    password_hash varchar(255) not null,
    full_name varchar(255) not null,
    role user_role default 'ATTENDEE',
    created_at timestamp default current_timestamp
);

create table events (
    id serial primary key,
    organizer_id int references users(id) on delete cascade,
    title varchar(255) not null,
    description text,
    venue_name varchar(255) not null,
    venue_address varchar(255) not null,
    start_time timestamp not null,
    end_time timestamp not null,
    capacity int not null,
    is_published boolean default false,
    paid_sales_active boolean default false,
    created_at timestamp default current_timestamp
);

create table ticket_types (
    id serial primary key,
    event_id int references events(id) on delete cascade,
    name varchar(100) not null,
    price decimal(10, 2) default 0.00,
    total_quantity int not null,
    remaining_quantity int not null,
    is_paid boolean default false
);
create table orders (
    id serial primary key,
    user_id int references users(id) on delete cascade,
    event_id int references events(id) on delete cascade,
    total_amount decimal(10, 2) not null,
    status order_status default 'PENDING',
    created_at timestamp default current_timestamp
);

create table tickets (
    id serial primary key,
    order_id int references orders(id) on delete cascade,
    ticket_type_id int references ticket_types(id),
    attendee_name varchar(255) not null,
    qr_code_hash varchar(255) unique not null,
    status ticket_status default 'VALID',
    created_at timestamp default current_timestamp
);
create table check_ins (
    id serial primary key,
    ticket_id int references tickets(id) on delete cascade,
    scanned_by int references users(id),
    scanned_at timestamp default current_timestamp
);
