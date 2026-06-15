from django.contrib import messages
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST

from .forms import CheckoutForm, ProfileForm, RegisterForm
from .models import (
    CartItem,
    Category,
    Order,
    OrderItem,
    Product,
    Profile,
    WishlistItem,
)


def home(request):
    products = Product.objects.filter(is_active=True).order_by("-created_at")[:8]
    categories = Category.objects.filter(is_active=True).order_by("name")[:6]
    return render(request, "shop/home.html", {
        "products": products,
        "categories": categories,
    })


def search(request):
    query = request.GET.get("q", "").strip()
    products = Product.objects.none()
    if query:
        products = Product.objects.filter(
            Q(name__icontains=query)
            | Q(description__icontains=query)
            | Q(category__name__icontains=query),
            is_active=True,
        ).distinct()
    return render(request, "shop/search.html", {
        "query": query,
        "products": products,
    })


def category_list(request):
    categories = Category.objects.filter(is_active=True)
    return render(request, "shop/collections.html", {"categories": categories})


def category_detail(request, slug):
    category = get_object_or_404(Category, slug=slug, is_active=True)
    products = category.products.filter(is_active=True)
    return render(request, "shop/category_products.html",
                  {"category": category, "products": products})


def product_detail(request, slug):
    product = get_object_or_404(Product, slug=slug, is_active=True)
    related = Product.objects.filter(
        category=product.category, is_active=True
    ).exclude(pk=product.pk)[:4]
    in_wishlist = False
    if request.user.is_authenticated:
        in_wishlist = WishlistItem.objects.filter(
            user=request.user, product=product
        ).exists()
    return render(request, "shop/product_detail.html", {
        "product": product,
        "related": related,
        "in_wishlist": in_wishlist,
    })


def register_view(request):
    if request.user.is_authenticated:
        return redirect("shop:home")
    if request.method == "POST":
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, "Registration successful. Welcome!")
            return redirect("shop:home")
    else:
        form = RegisterForm()
    return render(request, "shop/register.html", {"form": form})


def login_view(request):
    if request.user.is_authenticated:
        return redirect("shop:home")
    if request.method == "POST":
        username = request.POST.get("username")
        password = request.POST.get("password")
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            messages.success(request, "Logged in successfully.")
            next_url = request.GET.get("next") or request.POST.get("next")
            return redirect(next_url or "shop:home")
        messages.error(request, "Invalid username or password.")
    return render(request, "shop/login.html")


def logout_view(request):
    logout(request)
    messages.info(request, "You have been logged out.")
    return redirect("shop:home")


@login_required
def profile_view(request):
    profile, _ = Profile.objects.get_or_create(user=request.user)
    if request.method == "POST":
        form = ProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, "Profile updated successfully.")
            return redirect("shop:profile")
    else:
        form = ProfileForm(instance=profile)
    order_count = Order.objects.filter(user=request.user).count()
    return render(request, "shop/profile.html", {
        "form": form,
        "profile": profile,
        "order_count": order_count,
    })


@login_required
def add_to_cart(request, product_id):
    product = get_object_or_404(Product, id=product_id, is_active=True)
    item, created = CartItem.objects.get_or_create(user=request.user, product=product)
    if not created:
        item.qty += 1
        item.save()
    messages.success(request, "Product added to cart.")
    return redirect("shop:cart")


@login_required
def cart_view(request):
    items = CartItem.objects.filter(user=request.user).select_related("product")
    sub_total = sum(i.sub_total() for i in items)
    return render(request, "shop/cart.html", {"items": items, "sub_total": sub_total})


@login_required
@require_POST
def cart_update(request, product_id):
    item = get_object_or_404(CartItem, user=request.user, product_id=product_id)
    action = request.POST.get("action")
    if action == "increase":
        item.qty += 1
        item.save()
    elif action == "decrease":
        if item.qty > 1:
            item.qty -= 1
            item.save()
        else:
            item.delete()
    return redirect("shop:cart")


@login_required
def cart_remove(request, product_id):
    item = get_object_or_404(CartItem, user=request.user, product_id=product_id)
    item.delete()
    messages.info(request, "Product removed from cart.")
    return redirect("shop:cart")


@login_required
def wishlist_view(request):
    items = WishlistItem.objects.filter(user=request.user).select_related("product")
    return render(request, "shop/wishlist.html", {"items": items})


@login_required
def wishlist_toggle(request, product_id):
    product = get_object_or_404(Product, id=product_id, is_active=True)
    item, created = WishlistItem.objects.get_or_create(user=request.user, product=product)
    if created:
        messages.success(request, "Added to your wishlist.")
    else:
        item.delete()
        messages.info(request, "Removed from your wishlist.")
    next_url = request.GET.get("next") or request.META.get("HTTP_REFERER")
    return redirect(next_url or "shop:wishlist")


@login_required
def checkout(request):
    items = CartItem.objects.filter(user=request.user).select_related("product")
    if not items:
        messages.info(request, "Your cart is empty.")
        return redirect("shop:cart")
    sub_total = sum(i.sub_total() for i in items)

    profile = getattr(request.user, "profile", None)
    if request.method == "POST":
        form = CheckoutForm(request.POST)
        if form.is_valid():
            order = form.save(commit=False)
            order.user = request.user
            order.total = sub_total
            order.save()
            for item in items:
                OrderItem.objects.create(
                    order=order,
                    product=item.product,
                    product_name=item.product.name,
                    price=item.product.selling_price,
                    qty=item.qty,
                )
            items.delete()
            messages.success(request, f"Order #{order.pk} placed successfully!")
            return redirect("shop:order_detail", order_id=order.pk)
    else:
        initial = {}
        if profile:
            initial = {
                "full_name": profile.full_name or request.user.get_full_name(),
                "phone": profile.phone,
                "address": profile.address,
                "city": profile.city,
                "pincode": profile.pincode,
            }
        form = CheckoutForm(initial=initial)

    return render(request, "shop/checkout.html", {
        "items": items,
        "sub_total": sub_total,
        "form": form,
    })


@login_required
def order_list(request):
    orders = Order.objects.filter(user=request.user).prefetch_related("items")
    return render(request, "shop/orders.html", {"orders": orders})


@login_required
def order_detail(request, order_id):
    order = get_object_or_404(Order, pk=order_id, user=request.user)
    return render(request, "shop/order_detail.html", {"order": order})
